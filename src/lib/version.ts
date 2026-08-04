declare const __APP_VERSION__: string;

/** Single source for the application version, injected from package.json by Vite. */
export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "1.10.8";
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
