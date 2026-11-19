const builds = { royale:'../dist-royale/', '1':'../dist-preview/', practice:'../dist-practice/', match:'../dist-match/' };
export const buildRoot = new URL(builds[process.env.GAME_PREVIEW] || '../dist/', import.meta.url);
