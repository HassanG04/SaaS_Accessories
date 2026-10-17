import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { PaymentStatusBadge } from '@/features/orders/components/PaymentStatusBadge'
import { formatEGP, formatDate } from '@/lib/format'
import { useLanguage } from '@/i18n/LanguageProvider'
import { useToast } from '@/components/ui/ToastProvider'
import { Ltr } from '@/components/ui/Ltr'
import { useAdminApproveOrder } from './hooks'
import { OrderRejectDialog } from './OrderRejectDialog'
import {
  getAllowedTransitions,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DELIVERY_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
  getOrderWhatsAppApprovalUrl,
} from './transitions'
import type { AdminOrder } from './types'
import type { OrderStatus } from '@/features/orders/types'

export interface OrderDetailModalProps {
  open: boolean
  order: AdminOrder | null
  onClose: () => void
  onChangeStatus: (order: AdminOrder, targetStatus: OrderStatus) => void
  onEditFulfillment: (order: AdminOrder) => void
}

export function OrderDetailModal({
  open,
  order,
  onClose,
  onChangeStatus,
  onEditFulfillment,
}: OrderDetailModalProps) {
  const { lang } = useLanguage()
  const isAr = lang === 'ar'
  const toast = useToast()
  const approveMutation = useAdminApproveOrder()
  const [isRejectOpen, setIsRejectOpen] = useState(false)

  if (!open || !order) return null

  const isCancelled = order.status === 'cancelled'
  const isAwaitingApproval = order.payment_status === 'awaiting_approval'
  const allowedTransitions = getAllowedTransitions(order.status, {
    payment_method: order.payment_method,
    payment_status: order.payment_status,
  })
  const statusColor = ORDER_STATUS_COLORS[order.status] ?? ORDER_STATUS_COLORS.pending

  const handleApprove = async (withWhatsApp: boolean) => {
    try {
      await approveMutation.mutateAsync({ id: order.id })
      toast.success(isAr ? 'تمت الموافقة على الطلب بنجاح' : 'Order approved successfully')
      if (withWhatsApp) {
        const waUrl = getOrderWhatsAppApprovalUrl(order)
        if (typeof window !== 'undefined') {
          window.open(waUrl, '_blank')
        }
      }
      onClose()
    } catch {
      // Handled by mutation error if any
    }
  }

  return (
    <>
      <Dialog
        open
        title={isAr ? `تفاصيل الطلب #${order.id}` : `Order #${order.id} Details`}
        onClose={onClose}
      >
        <div className="space-y-6 max-w-2xl max-h-[75vh] overflow-y-auto pe-2">
          {/* Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-chip border border-border bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-caption font-semibold ${statusColor.bg} ${statusColor.borderClass} ${statusColor.text}`}
              >
                <span className={`size-1.5 rounded-pill ${statusColor.dot}`} aria-hidden="true" />
                <span>{ORDER_STATUS_LABELS[order.status]}</span>
              </span>
              <PaymentStatusBadge status={order.payment_status} />
            </div>

            <span className="text-caption text-text-muted">
              {formatDate(order.created_at, undefined, lang)}
            </span>
          </div>

          {/* Customer & Shipping Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Info */}
            <div className="rounded-chip border border-border bg-surface p-4 space-y-2">
              <h3 className="text-small font-bold text-brand">
                {isAr ? 'بيانات العميل' : 'Customer Details'}
              </h3>
              <div className="text-small space-y-1 text-text">
                <p className="font-semibold">{order.ship_name}</p>
                <p className="font-mono text-text-muted">
                  <Ltr>{order.ship_phone}</Ltr>
                </p>
                {order.ship_alt_phone ? (
                  <p className="font-mono text-caption text-text-muted">
                    {isAr ? 'هاتف بديل: ' : 'Alt phone: '}
                    <Ltr>{order.ship_alt_phone}</Ltr>
                  </p>
                ) : null}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="rounded-chip border border-border bg-surface p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-small font-bold text-brand">
                  {isAr ? 'عنوان التوصيل' : 'Delivery Address'}
                </h3>
                <span className="text-caption font-medium rounded-pill bg-surface-2 px-2 py-0.5 text-text-muted">
                  {DELIVERY_METHOD_LABELS[order.delivery_method]}
                </span>
              </div>
              <div className="text-small space-y-1 text-text">
                <p>
                  <span className="font-semibold">{order.ship_governorate}</span>
                  {order.ship_city ? ` - ${order.ship_city}` : ''}
                  {order.ship_district ? ` - ${order.ship_district}` : ''}
                </p>
                <p className="text-text-muted">{order.ship_address}</p>
                {order.ship_postal_code && (
                  <p className="text-caption text-text-muted">
                    {isAr ? 'الرمز البريدي: ' : 'Postal Code: '}
                    <span className="font-mono font-medium text-text">
                      <Ltr>{order.ship_postal_code}</Ltr>
                    </span>
                  </p>
                )}
                {(order.ship_floor || order.ship_apartment || order.ship_landmark) && (
                  <p className="text-caption text-text-muted">
                    {order.ship_floor ? `${isAr ? 'الدور: ' : 'Floor: '}${order.ship_floor} ` : ''}
                    {order.ship_apartment
                      ? `${isAr ? 'شقة: ' : 'Apt: '}${order.ship_apartment} `
                      : ''}
                    {order.ship_landmark ? `(${order.ship_landmark})` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Fulfillment Details */}
          <div className="rounded-chip border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-small font-bold text-brand">
                {isAr ? 'بيانات الشحن والتتبع' : 'Shipping & Fulfillment'}
              </h3>
              {!isCancelled && (
                <Button variant="ghost" size="default" onClick={() => onEditFulfillment(order)}>
                  {isAr ? 'تعديل البيانات' : 'Edit Details'}
                </Button>
              )}
            </div>

            {order.delivery_method === 'egypt_post' ? (
              <div className="text-small">
                <span className="text-text-muted">
                  {isAr ? 'رقم التتبع: ' : 'Tracking Number: '}
                </span>
                {order.tracking_number ? (
                  <span className="font-mono font-semibold text-text">
                    <Ltr>{order.tracking_number}</Ltr>
                  </span>
                ) : (
                  <span className="text-text-muted italic">
                    {isAr ? 'لم يُسجّل رقم تتبع بعد' : 'No tracking number recorded yet'}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-small space-y-1">
                <div>
                  <span className="text-text-muted">
                    {isAr ? 'اسم المندوب: ' : 'Representative: '}
                  </span>
                  <span className="font-semibold text-text">
                    {order.rep_name || (isAr ? 'غير محدد' : 'Unspecified')}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">{isAr ? 'هاتف المندوب: ' : 'Rep Phone: '}</span>
                  <span className="font-mono text-text">
                    {order.rep_phone ? (
                      <Ltr>{order.rep_phone}</Ltr>
                    ) : isAr ? (
                      'غير محدد'
                    ) : (
                      'Unspecified'
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Metadata */}
          <div className="rounded-chip border border-border bg-surface p-4 space-y-2">
            <h3 className="text-small font-bold text-brand">
              {order.payment_method === 'instapay_qr' ? (
                <Link
                  to={`/admin/payments?order=${order.id}`}
                  onClick={onClose}
                  className="ui-control inline-flex items-center underline underline-offset-4"
                >
                  {isAr ? 'معلومات الدفع' : 'Payment Information'} ↗
                </Link>
              ) : isAr ? (
                'معلومات الدفع'
              ) : (
                'Payment Information'
              )}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-small text-text">
              <div>
                <span className="text-text-muted">{isAr ? 'طريقة الدفع: ' : 'Method: '}</span>
                <span>{PAYMENT_METHOD_LABELS[order.payment_method]}</span>
              </div>
              <div>
                <span className="text-text-muted">
                  {isAr ? 'حالة الدفع: ' : 'Payment Status: '}
                </span>
                <PaymentStatusBadge status={order.payment_status} />
              </div>
              {order.payment_reference ? (
                <div className="sm:col-span-2">
                  <span className="text-text-muted">
                    {isAr ? 'رقم مرجع التحويل: ' : 'Reference: '}
                  </span>
                  <span className="font-mono font-semibold">
                    <Ltr>{order.payment_reference}</Ltr>
                  </span>
                </div>
              ) : null}
              {order.paid_at ? (
                <div>
                  <span className="text-text-muted">{isAr ? 'تاريخ الدفع: ' : 'Paid At: '}</span>
                  <span>{formatDate(order.paid_at, undefined, lang)}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Order Notes */}
          {order.notes ? (
            <div className="rounded-chip border border-border bg-surface p-4 space-y-1">
              <h3 className="text-small font-bold text-brand">
                {isAr ? 'ملاحظات العميل' : 'Customer Notes'}
              </h3>
              <p className="text-small text-text-muted whitespace-pre-wrap">{order.notes}</p>
            </div>
          ) : null}

          {/* Items List */}
          <div className="rounded-chip border border-border bg-surface overflow-hidden">
            <div className="p-3 bg-surface-2 border-b border-border">
              <h3 className="text-small font-bold text-brand">
                {isAr ? 'منتجات الطلب' : 'Order Items'} ({order.order_items.length})
              </h3>
            </div>

            <div className="divide-y divide-border">
              {order.order_items.map((item) => {
                const displayName = isAr
                  ? item.products?.name_ar || item.products?.name || item.product_name
                  : item.products?.name || item.product_name
                const lineTotal = item.quantity * item.unit_price

                return (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.products?.image_url ? (
                        <img
                          src={item.products.image_url}
                          alt=""
                          className="size-12 rounded-chip object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="size-12 rounded-chip bg-surface-2 border border-border shrink-0 flex items-center justify-center text-text-muted">
                          <span className="text-caption font-bold">L</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-small truncate text-text">{displayName}</p>
                        <p className="text-caption text-text-muted">
                          {item.quantity} × {formatEGP(item.unit_price, lang)}
                        </p>
                      </div>
                    </div>

                    <span className="font-bold text-small whitespace-nowrap text-brand">
                      {formatEGP(lineTotal, lang)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Financial Totals */}
            <div className="p-4 bg-surface-2 border-t border-border space-y-1.5 text-small">
              <div className="flex justify-between text-text-muted">
                <span>{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
                <span>{formatEGP(order.subtotal, lang)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>{isAr ? 'مصاريف الشحن' : 'Shipping Fee'}</span>
                <span>{formatEGP(order.shipping_fee, lang)}</span>
              </div>
              <div className="flex justify-between text-body font-bold text-brand pt-2 border-t border-border">
                <span>{isAr ? 'الإجمالي النهائي' : 'Total'}</span>
                <span>{formatEGP(order.total, lang)}</span>
              </div>
            </div>
          </div>

          {/* Status Transition Action Bar */}
          <div className="pt-4 border-t border-border">
            {isCancelled ? (
              <div
                role="alert"
                className="rounded-chip border border-border bg-surface-2 p-3 text-center text-small text-text-muted"
              >
                {isAr
                  ? 'هذا الطلب ملغي ونهائي (ORD-014). لا يمكن تعديل حالته أو إعادة فتحه.'
                  : 'This order is cancelled and final (ORD-014). It cannot be updated or reopened.'}
              </div>
            ) : isAwaitingApproval ? (
              <div className="space-y-3">
                <div
                  role="status"
                  className="rounded-chip border border-warning/30 bg-surface-tint p-3 text-small text-warning"
                >
                  <p className="font-semibold">
                    {isAr
                      ? 'طلب إنستاباي جديد بانتظار موافقة المتجر'
                      : 'New InstaPay order awaiting shop approval'}
                  </p>
                  <p className="text-caption text-text-muted mt-0.5">
                    {isAr
                      ? 'عند الموافقة، سيتم حجز مهلة الدفع وتفعيل رابط تحويل إنستاباي للعميل.'
                      : 'Upon approval, the payment deadline is set and payment instructions are enabled.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      disabled={approveMutation.isPending}
                      onClick={() => void handleApprove(true)}
                    >
                      {approveMutation.isPending
                        ? isAr
                          ? 'جارٍ الموافقة…'
                          : 'Approving…'
                        : isAr
                          ? 'موافقة وإرسال عبر واتساب'
                          : 'Approve & Send via WhatsApp'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={approveMutation.isPending}
                      onClick={() => void handleApprove(false)}
                    >
                      {isAr ? 'موافقة فقط' : 'Approve Only'}
                    </Button>
                  </div>

                  <Button
                    variant="danger"
                    disabled={approveMutation.isPending}
                    onClick={() => setIsRejectOpen(true)}
                  >
                    {isAr ? 'رفض الطلب' : 'Reject Order'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {order.payment_method === 'instapay_qr' && order.payment_status !== 'paid' && (
                  <div className="rounded-chip border border-warning/30 bg-surface-tint p-2.5 text-caption text-warning">
                    {isAr
                      ? 'تنبيه: لا يمكن شحن طلب إنستاباي قبل تأكيد استلام الدفع (ORD-015).'
                      : 'Note: InstaPay orders cannot be shipped before payment is confirmed (ORD-015).'}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {allowedTransitions
                      .filter((st) => st !== 'cancelled')
                      .map((target) => (
                        <Button
                          key={target}
                          variant="primary"
                          onClick={() => onChangeStatus(order, target)}
                        >
                          {target === 'confirmed' && (isAr ? 'تأكيد الطلب' : 'Confirm Order')}
                          {target === 'shipped' && (isAr ? 'شحن الطلب' : 'Ship Order')}
                          {target === 'delivered' && (isAr ? 'تسليم الطلب' : 'Deliver Order')}
                        </Button>
                      ))}
                  </div>

                  {allowedTransitions.includes('cancelled') && (
                    <Button variant="danger" onClick={() => onChangeStatus(order, 'cancelled')}>
                      {isAr ? 'إلغاء الطلب' : 'Cancel Order'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      <OrderRejectDialog
        open={isRejectOpen}
        order={order}
        onClose={() => setIsRejectOpen(false)}
        onSuccess={() => {
          setIsRejectOpen(false)
          onClose()
        }}
      />
    </>
  )
}
