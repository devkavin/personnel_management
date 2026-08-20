import { useEffect, useState } from "react";
import { Button, Card } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { z } from "zod";
import { api, type AuthUser, type Tenant } from "../../shared/api/client";
import { ConfirmAction, Notice, PageHeader, SearchableSelect } from "../../shared/components";
import { Field } from "../../shared/components/Field";
import { messageOf, timezoneOptions } from "../../shared/page-utils";
import { useUnsavedChanges } from "../../shared/hooks/useUnsavedChanges";

const profileSchema = z.object({ displayName: z.string().trim().min(2, "Enter at least 2 characters"), email: z.union([z.literal(""), z.email("Enter a valid email address")]), timezone: z.string().min(1, "Select a timezone") });
const passwordSchema = z.object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: z.string().min(8, "Use at least 8 characters") });

export function ProfilePage({ session, tenant, onSession }: { session: { token: string; user: AuthUser }; tenant: Tenant | null; onSession: (session: { token: string; user: AuthUser }) => void }) {
  const initialProfile = { ...session.user, timezone: session.user.timezone || "Asia/Colombo" };
  const [profile, setProfile] = useState(initialProfile); const [savedProfile, setSavedProfile] = useState(initialProfile); const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" }); const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const profileDirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const passwordDirty = Boolean(passwords.currentPassword || passwords.newPassword);
  useUnsavedChanges(profileDirty || passwordDirty);
  useEffect(() => { api.profile(session.token).then((data) => { setProfile(data.user); setSavedProfile(data.user); }).catch((err) => setError(messageOf(err))); }, [session.token]);

  function validateProfile() {
    const result = profileSchema.safeParse({ ...profile, email: profile.email ?? "" });
    setFieldErrors(result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
    return result.success;
  }
  function validatePassword() {
    const result = passwordSchema.safeParse(passwords);
    setFieldErrors(result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [`password.${String(issue.path[0])}`, issue.message])));
    return result.success;
  }

  return <div className="page-stack"><PageHeader eyebrow="Account" title="Profile and security" description="Manage your identity and login credentials." />{notice ? <Notice message={notice} tone="success" /> : null}{error ? <Notice message={error} tone="danger" /> : null}<div className="split-panels"><Card className="form-card"><Card.Header><h3>Profile</h3></Card.Header><Card.Content><Field label="Display name" value={profile.displayName} error={fieldErrors.displayName} onChange={(displayName) => setProfile({ ...profile, displayName })} required /><Field label="Email" type="email" value={profile.email ?? ""} error={fieldErrors.email} onChange={(email) => setProfile({ ...profile, email })} />{tenant ? <><Field label={tenant.userIdentifierLabel} value={profile.userIdentifier ?? ""} onChange={(userIdentifier) => setProfile({ ...profile, userIdentifier })} /><Field label={tenant.newUserIdentifierLabel} value={profile.newUserIdentifier ?? ""} onChange={(newUserIdentifier) => setProfile({ ...profile, newUserIdentifier })} /></> : null}<SearchableSelect label="Timezone" value={profile.timezone} onChange={(timezone) => setProfile({ ...profile, timezone })} options={timezoneOptions} /><div className="form-actions">{profileDirty ? <Button variant="ghost" onPress={() => { setProfile(savedProfile); setFieldErrors({}); }}><RotateCcw size={16} />Reset</Button> : null}<ConfirmAction label="Save profile" title="Save profile changes?" description="Your session and displayed local time will update immediately." disabled={!profileDirty} validate={validateProfile} onConfirm={async () => { const next = await api.updateProfile(session.token, { displayName: profile.displayName, email: profile.email || null, userIdentifier: profile.userIdentifier, newUserIdentifier: profile.newUserIdentifier, timezone: profile.timezone }); onSession(next); setProfile(next.user); setSavedProfile(next.user); setNotice("Profile updated"); }} /></div></Card.Content></Card><Card className="form-card"><Card.Header><h3>Password</h3></Card.Header><Card.Content><Field label="Current password" type="password" value={passwords.currentPassword} error={fieldErrors["password.currentPassword"]} autoComplete="current-password" onChange={(currentPassword) => setPasswords({ ...passwords, currentPassword })} required /><Field label="New password" type="password" value={passwords.newPassword} error={fieldErrors["password.newPassword"]} minLength={8} autoComplete="new-password" onChange={(newPassword) => setPasswords({ ...passwords, newPassword })} required /><div className="form-actions">{passwordDirty ? <Button variant="ghost" onPress={() => { setPasswords({ currentPassword: "", newPassword: "" }); setFieldErrors({}); }}><RotateCcw size={16} />Clear</Button> : null}<ConfirmAction label="Change password" title="Change your password?" description="Use the new password the next time you sign in." validate={validatePassword} onConfirm={async () => { await api.updatePassword(session.token, passwords); setPasswords({ currentPassword: "", newPassword: "" }); setNotice("Password changed"); }} /></div></Card.Content></Card></div></div>;
}
