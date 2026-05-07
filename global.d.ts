// Ambient declarations for things Next 16's auto-generated next-env.d.ts
// no longer covers but that the App Router relies on at compile time.

declare module "*.css";

// Dropbox Saver drop-in (loaded via <Script> in layout.tsx)
interface DropboxSaveOptions {
  files: Array<{ url: string; filename: string }>;
  success?: () => void;
  cancel?: () => void;
  error?: (errorMessage: string) => void;
  progress?: (progress: number) => void;
}

interface DropboxGlobal {
  save: (options: DropboxSaveOptions) => void;
}

declare const Dropbox: DropboxGlobal | undefined;
