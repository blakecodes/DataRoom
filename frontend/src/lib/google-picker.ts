import { GOOGLE_API_KEY, GOOGLE_APP_ID } from "@/config";
import { getPickerToken } from "@/lib/api/google";

// Minimal typings for the Google Picker globals we use.
declare global {
    interface Window {
        gapi?: { load: (name: string, cb: () => void) => void };
        google?: {
            picker: {
                PickerBuilder: new () => GooglePickerBuilder;
                DocsView: new () => GoogleDocsView;
                ViewId: { DOCS: string };
                Action: { PICKED: string; CANCEL: string };
                Feature: { MULTISELECT_ENABLED: string };
                Response: { ACTION: string; DOCUMENTS: string };
                Document: { ID: string; NAME: string };
            };
        };
    }
}

interface GoogleDocsView {
    setIncludeFolders: (v: boolean) => GoogleDocsView;
    setSelectFolderEnabled: (v: boolean) => GoogleDocsView;
    setMode: (mode: unknown) => GoogleDocsView;
}

interface GooglePickerBuilder {
    addView: (view: unknown) => GooglePickerBuilder;
    setOAuthToken: (token: string) => GooglePickerBuilder;
    setDeveloperKey: (key: string) => GooglePickerBuilder;
    setAppId: (id: string) => GooglePickerBuilder;
    enableFeature: (feature: string) => GooglePickerBuilder;
    setCallback: (cb: (data: PickerCallbackData) => void) => GooglePickerBuilder;
    setTitle: (title: string) => GooglePickerBuilder;
    build: () => { setVisible: (v: boolean) => void };
}

interface PickerCallbackData {
    [key: string]: unknown;
}

export interface PickedFile {
    id: string;
    name: string;
}

let scriptPromise: Promise<void> | null = null;

function loadGapiScript(): Promise<void> {
    if (window.gapi) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google API script."));
        document.body.appendChild(script);
    });
    return scriptPromise;
}

function loadPickerModule(): Promise<void> {
    return new Promise((resolve) => {
        window.gapi!.load("picker", () => resolve());
    });
}

/** Opens the Google Picker and resolves with the selected files (ids + names). */
export async function openGooglePicker(): Promise<PickedFile[]> {
    const { accessToken } = await getPickerToken();
    await loadGapiScript();
    await loadPickerModule();

    const picker = window.google!.picker;

    return new Promise<PickedFile[]>((resolve, reject) => {
        try {
            const view = new picker.DocsView()
                .setIncludeFolders(true)
                .setSelectFolderEnabled(false);

            const builder = new picker.PickerBuilder()
                .addView(view)
                .setOAuthToken(accessToken)
                .setDeveloperKey(GOOGLE_API_KEY)
                .enableFeature(picker.Feature.MULTISELECT_ENABLED)
                .setTitle("Select files to import")
                .setCallback((data: PickerCallbackData) => {
                    const action = data[picker.Response.ACTION];
                    if (action === picker.Action.PICKED) {
                        const docs = (data[picker.Response.DOCUMENTS] as Record<string, unknown>[]) ?? [];
                        resolve(
                            docs.map((doc) => ({
                                id: String(doc[picker.Document.ID]),
                                name: String(doc[picker.Document.NAME] ?? ""),
                            })),
                        );
                    } else if (action === picker.Action.CANCEL) {
                        resolve([]);
                    }
                });

            if (GOOGLE_APP_ID) builder.setAppId(GOOGLE_APP_ID);
            builder.build().setVisible(true);
        } catch (err) {
            reject(err instanceof Error ? err : new Error("Failed to open Google Picker."));
        }
    });
}
