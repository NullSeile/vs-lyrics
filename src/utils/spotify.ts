import * as vscode from 'vscode';
import axios from "axios";

import { Auth } from "../types/auth";
import { Playing } from "../types/playing";

export const secret: string = 'f09530cef3174711a1fba957fc81e7a1';
export const clientId: string = '49b379f897564e3993c6998a9fc3af1d';
export const redirectUri: string = 'http://localhost:9878/callback';
const basic: string = Buffer.from(`${clientId}:${secret}`).toString('base64');


const refreshToken = async (refreshToken: string): Promise<Auth> => {
    try {
        const body = new URLSearchParams({
            'client_id': clientId,
            'redirect_uri': redirectUri,
            'grant_type': 'refresh_token',
            'refresh_token': refreshToken
        });

        const response = await axios.post('https://accounts.spotify.com/api/token', body,
            {
                headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", }
            }
        );

        const data = response.data;
        return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken, expiredIn: Date.now() + data.expires_in };
    }
    catch (e) {
        return { exception: { code: 401, message: 'Refreshing token failed' } };
    }
};

const getToken = async (code: string): Promise<Auth> => {
    try {
        const body = new URLSearchParams({
            'client_id': clientId,
            'redirect_uri': redirectUri,
            'grant_type': 'authorization_code',
            'code': code
        });

        const response = await axios.post('https://accounts.spotify.com/api/token', body,
            {
                headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", }
            }
        );

        const data = response.data;
        return { accessToken: data.access_token, refreshToken: data.refresh_token, expiredIn: Date.now() + data.expires_in };
    }
    catch (e) {
        return { exception: { code: 401, message: 'Get access token failed' } };
    }
};

const getNowPlaying = async (token: string): Promise<Playing> => {
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player',
            {
                headers: { "Authorization": `Bearer ${token}` }
            }
        );

        const data = response.data;

        if (data.item.artists.length === 0) {
            return { exception: { code: 404, message: 'Failed to fetch artist name' } };
        }
        return { id: data.item.id, artistName: data.item.artists[0].name, songTitle: data.item.name, currentProgress: data.progress_ms, albumName: data.item.album.name };
    } catch (e) {
        return { exception: { code: 404, message: 'Spotify not playing any song' } };
    }
};

const getAuthorizationCode = (): void => {
    vscode.env.openExternal(vscode.Uri.parse(`https://accounts.spotify.com/en/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=user-read-playback-state`));
};

export { refreshToken, getToken, getNowPlaying, getAuthorizationCode };