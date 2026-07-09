import { useNavigate } from "@tanstack/react-router";
import { DialogTrigger } from "react-aria-components/Modal";
import { Button } from "@/client/components/shared/atoms/Button";
import { Dialog, Heading } from "@/client/components/shared/atoms/Dialog";
import { Modal } from "@/client/components/shared/atoms/Modal";
import { useTerraDeauthenticate } from "@/client/hooks/useTerraMutations";

export function DisconnectModal({
  providerName,
  connectionId,
}: {
  providerName: string;
  connectionId: string;
}) {
  const navigate = useNavigate();
  const deauthenticateMutation = useTerraDeauthenticate();

  return (
    <DialogTrigger>
      <Button variant="destructive" className="w-full">
        Disconnect
      </Button>
      <Modal>
        <Dialog>
          {({ close }) => (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Heading slot="title">Disconnect {providerName}?</Heading>
                <p className="text-base text-secondary-text">
                  This action is irreversible. Your connection and its
                  associated data will be deleted.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  className="rounded-full"
                  onPress={close}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  isPending={deauthenticateMutation.isPending}
                  onPress={() => {
                    deauthenticateMutation.mutate(connectionId, {
                      onSuccess: () => {
                        close();
                        navigate({ to: "/connectors" });
                      },
                    });
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}
