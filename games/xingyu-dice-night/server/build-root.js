export const buildRoot = new URL(process.env.GAME_PREVIEW === '1' ? '../dist-preview/' : '../dist/', import.meta.url);
