"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, LogOut, ShieldCheck } from "lucide-react";
import { Button, Field, Input, Modal, toast } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

export function AccountSettingsModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string; email?: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingProfile(true);
    try {
      await api("/api/auth/update-profile", {
        method: "POST",
        json: { name },
      });
      toast.success("Profile updated");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    if (newPassword !== confirmPassword) {
      setPwdError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPwdError("New password must be at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        json: { currentPassword, newPassword },
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwdError(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      toast.info("Signed out");
      router.push("/");
      router.refresh();
      onClose();
    } catch {
      router.push("/");
      router.refresh();
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Account Settings" wide>
      <div className="space-y-6">
        {/* Profile Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            <User size={13} className="text-accent" />
            Profile Details
          </div>
          {error && (
            <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {error}
            </div>
          )}
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <Field label="Display Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </Field>
            {user.email && (
              <Field label="Email Address">
                <Input value={user.email} disabled className="opacity-60 cursor-not-allowed" />
              </Field>
            )}
            <div className="flex justify-end">
              <Button type="submit" variant="brand" size="sm" loading={savingProfile}>
                Save Profile
              </Button>
            </div>
          </form>
        </section>

        <hr className="border-line" />

        {/* Change Password Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            <Lock size={13} className="text-accent" />
            Security & Password
          </div>
          {pwdError && (
            <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {pwdError}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <Field label="Current Password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New Password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
              </Field>
              <Field label="Confirm New Password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={changingPassword}
                disabled={!currentPassword || !newPassword}
              >
                <ShieldCheck size={13} />
                Update Password
              </Button>
            </div>
          </form>
        </section>

        <hr className="border-line" />

        {/* Sign Out Section */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-ink-3">Signed in as {user.name}</p>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleLogout}
            loading={loggingOut}
          >
            <LogOut size={13} />
            Sign Out
          </Button>
        </div>
      </div>
    </Modal>
  );
}
