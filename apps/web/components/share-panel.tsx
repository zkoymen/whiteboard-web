"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@whiteboard/ui";
import type { BoardMemberSummary, ShareLinkSummary } from "@whiteboard/shared";

async function request(path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed");
  }
  return payload;
}

export function SharePanel({ boardId, initialMembers, initialLinks }: { boardId: string; initialMembers: BoardMemberSummary[]; initialLinks: ShareLinkSummary[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function invite() {
    setError(null);
    startTransition(async () => {
      try {
        await request(`/api/boards/${boardId}/members`, {
          method: "POST",
          body: JSON.stringify({ email, role }),
        });
        setEmail("");
        refresh();
      } catch (inviteError) {
        setError(inviteError instanceof Error ? inviteError.message : "Failed to invite user");
      }
    });
  }

  function updateMember(userId: string, nextRole: "editor" | "viewer") {
    startTransition(async () => {
      try {
        await request(`/api/boards/${boardId}/members/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({ role: nextRole }),
        });
        refresh();
      } catch (memberError) {
        setError(memberError instanceof Error ? memberError.message : "Failed to update member");
      }
    });
  }

  function removeMember(userId: string) {
    startTransition(async () => {
      try {
        await request(`/api/boards/${boardId}/members/${userId}`, { method: "DELETE" });
        refresh();
      } catch (memberError) {
        setError(memberError instanceof Error ? memberError.message : "Failed to remove member");
      }
    });
  }

  function createLink(mode: "view" | "edit") {
    setError(null);
    startTransition(async () => {
      try {
        const payload = await request(`/api/boards/${boardId}/share-links`, {
          method: "POST",
          body: JSON.stringify({ mode }),
        });
        setGeneratedLink(payload.url);
        refresh();
      } catch (linkError) {
        setError(linkError instanceof Error ? linkError.message : "Failed to create link");
      }
    });
  }

  function revokeLink(linkId: string) {
    startTransition(async () => {
      try {
        await request(`/api/boards/${boardId}/share-links/${linkId}`, { method: "DELETE" });
        refresh();
      } catch (linkError) {
        setError(linkError instanceof Error ? linkError.message : "Failed to revoke link");
      }
    });
  }

  return (
    <Card className="share-panel">
      <div>
        <p className="eyebrow">Sharing</p>
        <h2>Invite people or generate a link</h2>
      </div>

      <div className="share-form-row">
        <Input placeholder="Collaborator email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <select className="ui-input" value={role} onChange={(event) => setRole(event.target.value as "editor" | "viewer")}> 
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <Button onClick={invite} disabled={isPending}>Invite</Button>
      </div>

      <div className="share-actions">
        <Button className="is-secondary" onClick={() => createLink("view")} disabled={isPending}>Copy view link</Button>
        <Button className="is-secondary" onClick={() => createLink("edit")} disabled={isPending}>Copy edit link</Button>
      </div>

      {generatedLink ? <Input readOnly value={generatedLink} onFocus={(event) => event.currentTarget.select()} /> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="share-lists">
        <div>
          <h3>Members</h3>
          {initialMembers.length === 0 ? <p className="muted">No invited members yet.</p> : null}
          {initialMembers.map((member) => (
            <div className="share-item" key={member.userId}>
              <div>
                <strong>{member.name}</strong>
                <span className="muted">{member.email}</span>
              </div>
              <div className="share-item-actions">
                <select className="ui-input" value={member.role} onChange={(event) => updateMember(member.userId, event.target.value as "editor" | "viewer")}> 
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <Button className="is-secondary danger" onClick={() => removeMember(member.userId)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h3>Links</h3>
          {initialLinks.length === 0 ? <p className="muted">No active links yet.</p> : null}
          {initialLinks.map((link) => (
            <div className="share-item" key={link.id}>
              <div>
                <strong>{link.mode} link</strong>
                <span className="muted">{link.revokedAt ? "Revoked" : "Active"}</span>
              </div>
              <Button className="is-secondary danger" onClick={() => revokeLink(link.id)} disabled={Boolean(link.revokedAt)}>Revoke</Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
