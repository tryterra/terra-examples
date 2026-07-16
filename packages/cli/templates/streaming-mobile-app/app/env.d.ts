// Expo inlines EXPO_PUBLIC_* variables at build time via process.env.
declare const process: {
  env: {
    EXPO_PUBLIC_TERRA_DEV_ID?: string;
    [key: string]: string | undefined;
  };
};
