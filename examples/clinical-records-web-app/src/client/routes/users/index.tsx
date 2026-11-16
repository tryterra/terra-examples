import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretRightIcon, PlusIcon } from "@phosphor-icons/react";
import { Badge } from "../../components/shared/atoms/Badge";
import { Button } from "../../components/shared/atoms/Button";
import { Dialog, Heading } from "../../components/shared/atoms/Dialog";
import { Form } from "../../components/shared/atoms/Form";
import { GridList, GridListItem } from "../../components/shared/atoms/GridList";
import { Modal } from "../../components/shared/atoms/Modal";
import { Skeleton } from "../../components/shared/atoms/Skeleton";
import { TextField } from "../../components/shared/atoms/TextField";
import { toastQueue } from "../../components/shared/atoms/Toast";
import { EmptyState } from "../../components/shared/atoms/EmptyState";
import { Meta } from "../../components/shared/Meta";
import { api, unwrap } from "../../lib/api";
import { healthQuery, usersQuery, type UserRow } from "../../lib/queries";
import { formatRelativeTime } from "../../lib/format";

export const Route = createFileRoute("/users/")({
  component: UsersPage,
});

function UsersPage() {
  const navigate = useNavigate();
  const usersQ = useQuery(usersQuery);
  const healthQ = useQuery(healthQuery);
  const demo = healthQ.data?.demo === true;
  const [addOpen, setAddOpen] = useState(false);
  const users = usersQ.data?.users ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-main-black">
            Clinical records
          </h1>
          <p className="text-sm text-secondary-text">
            Apple Health Records shared by your Terra users, as readable charts.
          </p>
        </div>
        <Button
          variant="primary"
          className="shrink-0 whitespace-nowrap"
          isDisabled={demo}
          onPress={() => setAddOpen(true)}
        >
          <PlusIcon size={18} weight="bold" />
          {demo ? "Add user (needs credentials)" : "Add user"}
        </Button>
      </div>

      {usersQ.isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : usersQ.isError ? (
        <EmptyState>Could not load users: {usersQ.error.message}</EmptyState>
      ) : users.length === 0 ? (
        <EmptyState>
          No users yet. Add a Terra user ID, or connect one through Apple Health
          and let the auth webhook register them.
        </EmptyState>
      ) : (
        <GridList
          aria-label="Users"
          onAction={(key) =>
            navigate({
              to: "/users/$userId",
              params: { userId: String(key) },
            })
          }
        >
          {users.map((u) => (
            <UserRowItem key={u.userId} user={u} />
          ))}
        </GridList>
      )}

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function UserRowItem({ user: u }: { user: UserRow }) {
  return (
    <GridListItem id={u.userId} textValue={u.referenceId ?? u.userId}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate font-medium text-main-black">
          {u.referenceId ?? u.userId}
        </span>
        <div className="flex flex-wrap items-start gap-x-6">
          <Meta label="User ID" mono>
            {u.userId}
          </Meta>
          <Meta label="Provider">{u.provider}</Meta>
        </div>
      </div>
      <div className="w-32 shrink-0">
        <Meta label="Records">
          {u.records > 0 ? (
            <Badge variant="emphasis">{u.records} records</Badge>
          ) : (
            <Badge variant="neutral">None yet</Badge>
          )}
        </Meta>
      </div>
      <div className="hidden w-32 shrink-0 sm:block">
        <Meta label="Health systems">{u.sources}</Meta>
      </div>
      <div className="hidden w-36 shrink-0 md:block">
        <Meta label="Last received">
          {formatRelativeTime(u.lastReceivedAt)}
        </Meta>
      </div>
      <CaretRightIcon size={20} className="shrink-0 text-subtle-text" />
    </GridListItem>
  );
}

function AddUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: async (userId: string) =>
      unwrap<{ userId: string; sync: { records: number } }>(
        await api.api.users.$post({ json: { userId } }),
      ),
    onSuccess: async ({ sync }) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toastQueue.add({ title: `User added, ${sync.records} records synced` });
      onClose();
    },
    onError: (err) => toastQueue.add({ title: err.message, variant: "error" }),
  });

  return (
    <Modal isOpen={open} onOpenChange={(v) => !v && onClose()} isDismissable>
      <Dialog>
        <Heading slot="title">Add user</Heading>
        <Form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            create.mutate(String(form.get("userId") ?? "").trim());
          }}
        >
          <TextField
            name="userId"
            label="Terra user ID"
            description="An Apple Health user with CLINICAL_RECORD enabled. Their records are backfilled from the pull API."
            isRequired
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onPress={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isDisabled={create.isPending}
            >
              {create.isPending ? "Syncing…" : "Add and sync"}
            </Button>
          </div>
        </Form>
      </Dialog>
    </Modal>
  );
}
