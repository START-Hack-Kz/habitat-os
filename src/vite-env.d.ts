declare module "*?raw" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AI_BASE_URL?: string;
<<<<<<< HEAD
=======
  readonly VITE_MISSION_POLL_MS?: string;
  readonly VITE_CONTROL_APPLY_DELAY_MS?: string;
>>>>>>> 3ce8c794337794602881965d18258dc26accf9e6
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
