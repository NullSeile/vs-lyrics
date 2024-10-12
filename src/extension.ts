import * as vscode from 'vscode';
import fs from 'node:fs';
import express, { Request, Response } from "express";
import { SingeLongViewProvider } from './panel/panel';
import * as spotify from './utils/spotify';
import * as lyric from './utils/lyric';
import { Auth } from './types/auth';
import { Playing } from './types/playing';

let extensionContext: vscode.ExtensionContext;
let provider: SingeLongViewProvider;
let extensionUri: vscode.Uri;
let prevPlaying: Playing;

export function activate(context: vscode.ExtensionContext) {

    // making private context accessed globally;
    extensionContext = context;
    provider = new SingeLongViewProvider(context.extensionUri);
    extensionUri = context.extensionUri;

    // define authorize command in vscode
    let login = vscode.commands.registerCommand('vs-lyrics.authorize', () => authorize());
    context.subscriptions.push(login);

    // define logout command in vscode
    let logout = vscode.commands.registerCommand('vs-lyrics.logout', () => signOut());
    context.subscriptions.push(logout);

    // creating panel
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SingeLongViewProvider.viewType,
            provider
        )
    );
    // listen updates
    const timeout = setTimeout(async () => {
        await listener();
        timeout.refresh();
    }, 1000);
}

const authorize = async () => {
    // start local webserver callback
    const app = express();

    app.get("/callback", async (req: Request, res: Response) => {
        const contentUri = vscode.Uri.joinPath(extensionUri, "assets", "close.html");
        const content = fs.readFileSync(contentUri.fsPath, 'utf-8');
        const code = req.query.code;

        extensionContext.globalState.update("code", code);
        await requestAccessToken();

        vscode.window.showInformationMessage('SingeLong: Spotify authorized successfully');
        res.send(content);
    });

    app.listen(9878);

    // open url to retrive spotify authorization code
    spotify.getAuthorizationCode();
};

const signOut = async () => extensionContext.globalState.update("auth", null);

const requestAccessToken = async (): Promise<Auth> => {
    const timestamp = Date.now();
    const auth = extensionContext.globalState.get<Auth>("auth");
    const code = extensionContext.globalState.get<string>("code");

    const expiredIn = auth?.expiredIn || 0;
    const refreshToken = auth?.refreshToken;
    const isTokenExpired = (timestamp >= expiredIn) && refreshToken != null; // eslint-disable-line
    const isTokenExist = (auth?.accessToken != null); // eslint-disable-line

    if (isTokenExpired) {
        if (!refreshToken) {
            provider.view?.webview.postMessage({ 'command': 'error', 'message': 'refresh token is missing' });
            return Promise.reject(`refresh token is missing for ${auth?.accessToken}`);
        }

        const data = await spotify.refreshToken(refreshToken);
        if (data.exception) {
            provider.view?.webview.postMessage({ 'command': 'error', 'message': data.exception.message });
        }
        extensionContext.globalState.update("auth", data);
        return data;
    }

    if (!isTokenExist || !auth) {
        const data = await spotify.getToken(code || '');
        if (data.exception) {
            provider.view?.webview.postMessage({ 'command': 'error', 'message': data.exception.message });
        }
        extensionContext.globalState.update("auth", data);
        return data;
    }

    extensionContext.globalState.update("auth", auth);
    return auth;
};

const listener = async () => {
    let auth = extensionContext.globalState.get<Auth>('auth');
    const isTokenExist = (auth?.accessToken != null); // eslint-disable-line
    if (!isTokenExist) {
        provider.view?.webview.postMessage({ 'command': 'error', 'message': 'spotify account isn\'t authorized yet' });
        return;
    } else {
        auth = await requestAccessToken();

        const playing = await spotify.getNowPlaying(auth.accessToken!);

        if (playing.exception) {
            return provider.view?.webview.postMessage({ 'command': 'error', 'message': playing.exception.message });
        } else {
            provider.view?.webview.postMessage({
                'command': 'setTime',
                'content': {
                    'milliseconds': playing.currentProgress
                }
            });
        }

        if (prevPlaying?.id !== playing.id) {
            const lyricData = await lyric.getLyric(playing);
            console.log('lyricData', lyricData);

            if (lyricData.exception) {
                return provider.view?.webview.postMessage({ 'command': 'error', 'message': lyricData.exception.message });
            }
            provider.view?.webview.postMessage({
                'command': 'setLyrics',
                'content': {
                    'lyrics': lyricData.lyric
                }
            });
        }
        prevPlaying = playing;
    }
};

export function deactivate() { }
