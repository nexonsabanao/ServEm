import { useState } from 'react';
import {
  AdminCollectionState,
  AdminPage,
  AdminTable,
  Checkbox,
  ContextCard,
  FilterRow,
  PaginationFooter,
} from '../../components/AdminUI';
import { Button, Chip, TextInput } from '../../components/ui';
import { Toggle } from '../../components/Toggle';
import { adminBootstrap, callableErrorMessage } from '../../lib/functions';
import { useAdminCollection } from '../../lib/useAdminCollection';
import type { AuditEntry, TeamMember } from '../../lib/types';

export function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    instantBook: true,
    requireVerification: true,
    autoRelease: true,
    reviewModeration: false,
    messageAlerts: true,
  });
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [bootstrapEmail, setBootstrapEmail] = useState('');
  const [bootstrapBusy, setBootstrapBusy] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const groups: { title: string; rows: [keyof typeof settings, string, string][] }[] = [
    {
      title: 'Bookings',
      rows: [
        ['instantBook', 'Instant booking', 'Customers can book verified ServMates without a manual accept'],
        ['autoRelease', 'Auto-release unaccepted requests', 'Free the time slot one hour before the start'],
      ],
    },
    {
      title: 'Trust & safety',
      rows: [
        ['requireVerification', 'Require verification', 'Only verified ServMates can accept jobs'],
        ['reviewModeration', 'Hold flagged reviews', 'Send low-rated reviews to the moderation queue'],
      ],
    },
    {
      title: 'Communications',
      rows: [['messageAlerts', 'Message alerts', 'Send in-app alerts for new messages']],
    },
  ];

  async function grantAdminRole() {
    setBootstrapBusy(true);
    setBootstrapMessage(null);
    setBootstrapError(null);
    try {
      const result = await adminBootstrap({ bootstrapToken: bootstrapToken.trim(), email: bootstrapEmail.trim() });
      setBootstrapMessage(`Admin claim granted to ${result.email}. They need to sign in again to pick it up.`);
    } catch (error) {
      setBootstrapError(callableErrorMessage(error));
    } finally {
      setBootstrapBusy(false);
    }
  }

  return (
    <AdminPage
      title="Platform settings"
      subtitle="ServEm operations · Philippines · Asia/Manila time"
      actions={<Chip small tone="neutral">Least-privilege workspace</Chip>}
    >
      <div className="mt-4 grid grid-cols-[1fr_260px] gap-4 max-lg:grid-cols-1">
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.title} className="card p-5">
              <h2 className="text-[14px] font-semibold">{group.title}</h2>
              <div className="mt-2 divide-y divide-[var(--color-line-2)]">
                {group.rows.map(([key, title, body]) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <p className="text-[12.5px] font-medium">{title}</p>
                      <p className="mt-0.5 text-[11.5px] text-[var(--color-muted)]">{body}</p>
                    </div>
                    <Toggle
                      checked={settings[key]}
                      onChange={(value) => setSettings({ ...settings, [key]: value })}
                      label={title}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="card p-5">
            <h2 className="text-[14px] font-semibold">Grant the first admin role</h2>
            <p className="mt-1 text-[11.5px] text-[var(--color-muted)]">
              Uses the one-time bootstrap token from your server configuration. It only works while no admin exists.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
              <TextInput
                label="Bootstrap token"
                value={bootstrapToken}
                onChange={(event) => setBootstrapToken(event.target.value)}
                placeholder="Token from RunIt configuration"
                autoComplete="off"
              />
              <TextInput
                label="Work email"
                type="email"
                value={bootstrapEmail}
                onChange={(event) => setBootstrapEmail(event.target.value)}
                placeholder="name@servem.ph"
                autoComplete="off"
              />
            </div>
            {bootstrapError ? (
              <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">
                {bootstrapError}
              </p>
            ) : null}
            {bootstrapMessage ? (
              <p className="mt-2 text-[12px] text-[var(--color-brand-deep)]">{bootstrapMessage}</p>
            ) : null}
            <Button small className="mt-3" disabled={bootstrapBusy} onClick={() => void grantAdminRole()}>
              {bootstrapBusy ? 'Working…' : 'Grant admin claim'}
            </Button>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <ContextCard title="What saving means here">
            These toggles are held in this browser only. Platform policy is read by the servers from their own
            configuration, so changing a switch here does not change how live bookings behave.
          </ContextCard>
          <ContextCard title="Audit & safety">
            Admin decisions made elsewhere in this workspace are written by the `adminDecision` callable, which records
            the acting admin, the subject and a timestamp.
          </ContextCard>
        </aside>
      </div>
    </AdminPage>
  );
}

export function AdminTeamPage() {
  const team = useAdminCollection<TeamMember>('team');
  return (
    <AdminPage title="Team & permissions" subtitle="Staff accounts from the team collection">
      <FilterRow items={['Role: All', 'State: All', 'Workspace: Operations']} />
      <AdminCollectionState
        collection={team}
        empty={
          <ContextCard title="Least-privilege access">
            Walang team members recorded yet. Use “Grant the first admin role” in Platform settings to create the first
            staff account, then add the rest of the roster.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <div className="mt-3">
              <AdminTable
                headers={['Member', 'Email', 'Role', 'Scope', 'State']}
                footer={<PaginationFooter total={rows.length} />}
              >
                {rows.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Checkbox />
                    </td>
                    <td className="font-medium text-[var(--color-ink)]">{member.name}</td>
                    <td className="text-[var(--color-muted)]">{member.email}</td>
                    <td>{member.role}</td>
                    <td>{member.scope}</td>
                    <td>
                      <Chip
                        small
                        tone={member.status === 'active' ? 'brand' : member.status === 'invited' ? 'warn' : 'neutral'}
                        className="capitalize"
                      >
                        {member.status}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <ContextCard title="Least-privilege access">
              Admins see every workspace; support, finance and trust & safety scopes are enforced by Firestore rules and
              the admin callables, not by this screen. Adding a teammate is done by granting the admin claim, and email
              invitations are not sent by ServEm yet.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminAuditLogPage() {
  const audit = useAdminCollection<AuditEntry>('audit');
  return (
    <AdminPage title="Audit log" subtitle="Append-only decisions written by the admin callables">
      <FilterRow items={['Actor: All', 'Action: All', 'Date range: Last 7 days']} />
      <AdminCollectionState
        collection={audit}
        empty={
          <ContextCard title="Least-privilege workspace">
            Walang audit entries yet. Every admin decision writes an actor, action, subject and reason here.
          </ContextCard>
        }
      >
        {(rows) => (
          <div className="mt-3">
            <AdminTable
              headers={['Time', 'Actor', 'Action', 'Detail']}
              footer={<PaginationFooter total={rows.length} />}
              selectable={false}
            >
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-[var(--color-muted)]">{entry.time}</td>
                  <td>{entry.actor}</td>
                  <td>{entry.action}</td>
                  <td className="text-[var(--color-muted)]">{entry.detail}</td>
                </tr>
              ))}
            </AdminTable>
          </div>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}
