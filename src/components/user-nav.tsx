"use client";

import { useState } from "react";
import { AccountSettingsModal } from "@/components/account-settings-modal";

export function UserNav({ user }: { user: { name: string; email?: string } }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`${user.name} (Account Settings)`}
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-coral to-violet text-xs font-bold text-white shadow-xs transition-transform hover:scale-105 cursor-pointer"
      >
        {user.name.slice(0, 2).toUpperCase()}
      </button>

      <AccountSettingsModal
        open={open}
        onClose={() => setOpen(false)}
        user={user}
      />
    </>
  );
}
