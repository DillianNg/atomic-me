import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';

/** Render queue toast hien tai. Mount o providers de moi noi co the goi `toast()`. */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <ToastProvider duration={5000}>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onOpenChange={(open) => {
            if (!open) dismiss(t.id);
          }}
        >
          <div className="grid gap-1">
            {t.title !== undefined && <ToastTitle>{t.title}</ToastTitle>}
            {t.description !== undefined && <ToastDescription>{t.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
