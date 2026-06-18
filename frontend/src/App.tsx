import { Navigate, Route, Routes } from "react-router-dom";
import { DataRoomPage } from "@/pages/data-room-page";
import { LoginPage } from "@/pages/login-page";
import { SettingsPage } from "@/pages/settings-page";
import { SignupPage } from "@/pages/signup-page";
import { RedirectIfAuthed, RequireAuth } from "@/components/route-guard";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route
                path="/login"
                element={
                    <RedirectIfAuthed>
                        <LoginPage />
                    </RedirectIfAuthed>
                }
            />
            <Route
                path="/signup"
                element={
                    <RedirectIfAuthed>
                        <SignupPage />
                    </RedirectIfAuthed>
                }
            />
            <Route
                path="/app"
                element={
                    <RequireAuth>
                        <DataRoomPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/settings"
                element={
                    <RequireAuth>
                        <SettingsPage />
                    </RequireAuth>
                }
            />
        </Routes>
    );
}

export default App;
