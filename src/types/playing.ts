import { Exception } from "./exception";

export type Playing = {
    id?: string;
    isPlaying?: boolean;
    artistName?: string;
    songTitle?: string;
    albumName?: string;
    currentProgress?: number;
    exception?: Exception;
}