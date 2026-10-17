import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/i18n/LanguageProvider'
import { useSeo } from '@/features/seo'
import {
  useMyOrders,
  useCancelOrder,
  canCancelOrder,
  type CustomerOrder,
  OrderStatusTimeline,
  PaymentStatusBadge,
} from '@/features/orders'
import { formatEGP, formatDate } from '@/lib/format'
import { publicImageUrl } from '@/lib/images'
import { Ltr } from '@/components/ui/Ltr'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PearlLoader } from '@/components/ui/PearlLoader'
import { ErrorPanel } from '@/components/ui/ErrorPanel'
import { ErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/ui/ToastProvider'

export default function AccountOrdersPage() {
  const { t, lang } = useLanguage()
  const isEn = lang === 'en'
  const { data: orders, isLoading, isError, error, refetch } = useMyOrders()
  const cancelOrderMutation = useCancelOrder()
  const toast = useToast()

  const [orderToCancel, setOrderToCancel] = useState<CustomerOrder | null>(null)

  useSeo({
    title: t.account.orders,
    description: isEn
      ? "Track your order history and delivery statuses at Lolys' Accessories & Home"
      : 'سجل ومتابعة طلباتك في متجر لوليز',
  })

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return

    try {
      await cancelOrderMutation.mutateAsync(orderToCancel.id)
      toast.success(isEn ? 'Order cancelled successfully' : 'تم إلغاء الطلب بنجاح')
      setOrderToCancel(null)
    } catch {
      // Error handled by cancelOrderMutation.error in Dialog
    }
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label={isEn ? 'Loading orders...' : 'جارٍ تحميل الطلبات'}
        className="flex min-h-[350px] w-full items-center justify-center text-brand"
      >
        <PearlLoader loading />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-8">
        <ErrorPanel error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="rounded-card border border-border bg-surface p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-card">
        <div>
          <h1 className="text-h1 font-bold font-accent text-brand">{t.account.orders}</h1>
          <p className="mt-2 text-body text-text-muted">
            {isEn
              ? 'Your order history and shipping progress.'
              : 'سجل طلباتك وحالات الشحن والتوصيل.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/account/favorites"
            className="inline-flex h-11 items-center justify-center rounded-pill border border-border-input bg-surface-2 px-4 text-small font-semibold text-text hover:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {t.account.favorites}
          </Link>
          <Link
            to="/account/security"
            className="inline-flex h-11 items-center justify-center rounded-pill border border-border-input bg-surface-2 px-4 text-small font-semibold text-text hover:border-brand focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {t.account.security}
          </Link>
        </div>
      </div>

      {/* Orders List or Empty State */}
      {!orders || orders.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center space-y-4">
          <div className="flex size-14 mx-auto items-center justify-center rounded-pill bg-surface-tint text-brand">
            <svg
              className="size-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h2 className="text-h2 font-bold text-text">
            {isEn ? 'No previous orders yet' : 'لا توجد طلبات سابقة حتى الآن'}
          </h2>
          <p className="text-body text-text-muted max-w-md mx-auto">
            {isEn
              ? 'When you place orders, their details and delivery progress will appear here.'
              : 'عندما تقوم بإنشاء طلبات، ستظهر تفاصيلها وحالات الشحن والتوصيل هنا.'}
          </p>
          <div className="pt-2">
            <Link
              to="/category/all"
              className="inline-flex h-11 items-center justify-center rounded-pill bg-brand px-6 text-small font-semibold text-brand-contrast transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus shadow-pill"
            >
              {isEn ? 'Shop Now' : 'تسوّق الآن'}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const isPostal = order.delivery_method === 'egypt_post'
            const showCancel = canCancelOrder(order)
            const isInstaPayAwaiting =
              order.payment_method === 'instapay_qr' &&
              (order.payment_status === 'awaiting_proof' || order.payment_status === 'rejected') &&
              (order.status === 'pending' || order.status === 'confirmed')

            return (
              <Card
                key={order.id}
                className="overflow-hidden border border-border bg-surface shadow-card"
              >
                {/* Order Header */}
                <div className="border-b border-border bg-surface-2 p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <div>
                      <span className="text-caption text-text-muted block">
                        {isEn ? 'Order Number' : 'رقم الطلب'}
                      </span>
                      <span className="text-h3 font-bold font-mono text-brand">
                        <Ltr>#{order.id}</Ltr>
                      </span>
                    </div>

                    <div className="border-s border-border ps-3 sm:ps-4">
                      <span className="text-caption text-text-muted block">
                        {isEn ? 'Order Date' : 'تاريخ الطلب'}
                      </span>
                      <span className="text-small font-medium text-text">
                        {formatDate(order.created_at, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <PaymentStatusBadge status={order.payment_status} />
                    <span className="rounded-pill border border-border bg-surface px-2.5 py-0.5 text-caption font-medium text-text">
                      {order.payment_method === 'cod'
                        ? isEn
                          ? 'Cash on Delivery'
                          : 'الدفع عند الاستلام'
                        : isEn
                          ? 'InstaPay (QR)'
                          : 'إنستاباي (QR)'}
                    </span>
                    <span className="text-h3 font-bold text-brand ms-2">
                      <Ltr>{formatEGP(order.total)}</Ltr>
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-6">
                  {/* Status Timeline */}
                  <div className="rounded-card border border-border bg-surface-2 p-4">
                    <OrderStatusTimeline
                      status={order.status}
                      paymentStatus={order.payment_status}
                    />
                  </div>

                  {/* Delivery & Shipping Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-card border border-border bg-surface-2 p-4">
                    {/* Method details */}
                    <div className="space-y-2">
                      <h3 className="text-small font-bold text-brand flex items-center gap-2">
                        <svg
                          className="size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20"
                          />
                        </svg>
                        <span>
                          {isEn
                            ? `Shipping Details (${isPostal ? 'Egypt Post' : 'Courier'})`
                            : `بيانات الشحن (${isPostal ? 'البريد المصري' : 'مندوب توصيل'})`}
                        </span>
                      </h3>

                      {isPostal ? (
                        <div className="text-small space-y-1">
                          <span className="text-text-muted block">
                            {isEn ? 'Tracking Number:' : 'رقم الشحنة التتبعي:'}
                          </span>
                          {order.tracking_number ? (
                            <span className="font-mono font-bold text-text bg-surface px-2 py-1 rounded-chip border border-border inline-block">
                              <Ltr>{order.tracking_number}</Ltr>
                            </span>
                          ) : (
                            <span className="text-text-muted italic">
                              {isEn ? 'Assigning tracking number' : 'جارٍ تعيين رقم الشحنة'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-small space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted">
                              {isEn ? 'Courier:' : 'مندوب التوصيل:'}
                            </span>
                            <span className="font-medium text-text">
                              {order.rep_name ||
                                (order.rep_phone
                                  ? isEn
                                    ? "Lolys' Courier"
                                    : 'مندوب لوليز'
                                  : isEn
                                    ? 'Assigning courier'
                                    : 'جارٍ تعيين مندوب التوصيل')}
                            </span>
                          </div>
                          {order.rep_phone && (
                            <div className="flex items-center gap-2">
                              <span className="text-text-muted">
                                {isEn ? 'Courier Phone:' : 'هاتف المندوب:'}
                              </span>
                              <span className="font-mono font-medium text-text">
                                <Ltr>{order.rep_phone}</Ltr>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Address details */}
                    <div className="space-y-1 text-small">
                      <h3 className="font-bold text-brand flex items-center gap-2 mb-2">
                        <svg
                          className="size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>{isEn ? 'Delivery Address' : 'عنوان التوصيل'}</span>
                      </h3>
                      <p className="text-text">
                        <span className="font-medium">{order.ship_name}</span> ({order.ship_phone})
                      </p>
                      <p className="text-text-muted">
                        {order.ship_governorate}
                        {order.ship_city ? ` - ${order.ship_city}` : ''}
                        {order.ship_district ? ` - ${order.ship_district}` : ''}
                      </p>
                      <p className="text-text-muted">
                        {order.ship_address}
                        {order.ship_floor
                          ? isEn
                            ? `, Floor ${order.ship_floor}`
                            : `، الدور ${order.ship_floor}`
                          : ''}
                        {order.ship_apartment
                          ? isEn
                            ? `, Apt ${order.ship_apartment}`
                            : `، شقة ${order.ship_apartment}`
                          : ''}
                      </p>
                      {order.ship_postal_code && (
                        <p className="text-caption text-text-muted">
                          {isEn ? 'Postal Code: ' : 'الرمز البريدي: '}
                          <span className="font-mono font-medium text-text">
                            <Ltr>{order.ship_postal_code}</Ltr>
                          </span>
                        </p>
                      )}
                      {order.ship_landmark && (
                        <p className="text-caption text-text-muted">
                          {isEn ? 'Landmark: ' : 'علامة مميزة: '}
                          {order.ship_landmark}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Itemized Products List */}
                  <div className="space-y-3">
                    <h3 className="text-small font-bold text-text">
                      {isEn ? 'Ordered Products' : 'المنتجات المطلوبة'}
                    </h3>
                    <div className="divide-y divide-border rounded-card border border-border bg-surface">
                      {order.order_items?.map((item) => {
                        const imgUrl = publicImageUrl(item.products?.image_url)
                        const lineTotal = item.unit_price * item.quantity
                        const productName = isEn
                          ? item.products?.name || item.product_name
                          : item.products?.name_ar || item.product_name

                        return (
                          <div
                            key={item.id}
                            className="p-3 sm:p-4 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-14 shrink-0 overflow-hidden rounded-image border border-border bg-surface-2 flex items-center justify-center">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={productName}
                                    className="size-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="text-caption text-text-muted">
                                    {isEn ? 'Image' : 'صورة'}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-small font-semibold text-text truncate">
                                  {productName}
                                </h4>
                                <div className="text-caption text-text-muted flex items-center gap-2 mt-0.5">
                                  <span>
                                    {isEn ? 'Unit price: ' : 'سعر القطعة: '}
                                    <Ltr>{formatEGP(item.unit_price)}</Ltr>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {isEn ? 'Quantity: ' : 'الكمية: '}
                                    {item.quantity}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-end shrink-0">
                              <span className="text-small font-bold text-brand block">
                                <Ltr>{formatEGP(lineTotal)}</Ltr>
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-border">
                    <div className="text-small text-text-muted space-y-1">
                      <div>
                        {isEn ? 'Subtotal: ' : 'المجموع الفرعي: '}
                        <Ltr>{formatEGP(order.subtotal)}</Ltr>
                      </div>
                      <div>
                        {isEn ? 'Shipping: ' : 'مصاريف الشحن: '}
                        <Ltr>{formatEGP(order.shipping_fee)}</Ltr>
                      </div>
                    </div>

                    {/* Actions and Cancellation */}
                    <div className="flex flex-wrap items-center gap-3">
                      {isInstaPayAwaiting && (
                        <Link
                          to={`/pay/${order.id}`}
                          className="inline-flex h-10 items-center justify-center rounded-pill bg-brand px-4 text-small font-semibold text-brand-contrast hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus"
                        >
                          {isEn ? 'Complete Payment (InstaPay)' : 'استكمال الدفع (إنستاباي)'}
                        </Link>
                      )}

                      {order.payment_status === 'awaiting_approval' && (
                        <span className="text-caption text-text-muted bg-surface-2 px-3 py-1.5 rounded-pill border border-border">
                          {isEn
                            ? 'Your order was received. We will review it and send your payment link shortly.'
                            : 'وصل طلبك للمتجر. سنراجعه ونرسل لك رابط الدفع قريبًا.'}
                        </span>
                      )}

                      {order.payment_status === 'under_review' && (
                        <span className="text-caption text-caramel bg-surface-tint px-3 py-1.5 rounded-pill border border-caramel">
                          {isEn
                            ? 'Transfer receipt is under management review'
                            : 'إيصال التحويل قيد مراجعة الإدارة'}
                        </span>
                      )}

                      {showCancel && (
                        <Button
                          variant="ghost"
                          onClick={() => setOrderToCancel(order)}
                          className="text-danger hover:bg-surface-tint border border-danger"
                        >
                          {isEn ? 'Cancel Order' : 'إلغاء الطلب'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Cancel Order Confirmation Dialog */}
      <Dialog
        open={Boolean(orderToCancel)}
        title={isEn ? 'Confirm Order Cancellation' : 'تأكيد إلغاء الطلب'}
        description={
          isEn
            ? 'Are you sure you want to cancel this order? The order will be cancelled immediately and items returned to available stock.'
            : 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ سيتم إلغاء الطلب فورًا واسترجاع المنتجات إلى المخزون المتاح في المتجر.'
        }
        onClose={() => {
          if (!cancelOrderMutation.isPending) {
            setOrderToCancel(null)
          }
        }}
      >
        <div className="space-y-4">
          {orderToCancel && (
            <div className="rounded-card border border-border bg-surface-2 p-3 text-small">
              <span className="text-text-muted block mb-1">
                {isEn ? 'Order to cancel:' : 'الطلب المراد إلغاؤه:'}
              </span>
              <span className="font-bold text-brand">
                {isEn ? (
                  <>
                    Order <Ltr>#{orderToCancel.id}</Ltr> totaling{' '}
                    <Ltr>{formatEGP(orderToCancel.total)}</Ltr>
                  </>
                ) : (
                  <>
                    طلب رقم <Ltr>#{orderToCancel.id}</Ltr> بمبلغ{' '}
                    <Ltr>{formatEGP(orderToCancel.total)}</Ltr>
                  </>
                )}
              </span>
            </div>
          )}

          {cancelOrderMutation.isError && <ErrorMessage error={cancelOrderMutation.error} />}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setOrderToCancel(null)}
              disabled={cancelOrderMutation.isPending}
            >
              {isEn ? 'Keep Order' : 'تراجع'}
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleConfirmCancel()}
              disabled={cancelOrderMutation.isPending}
            >
              {cancelOrderMutation.isPending
                ? isEn
                  ? 'Cancelling…'
                  : 'جارٍ الإلغاء…'
                : isEn
                  ? 'Confirm Cancellation'
                  : 'تأكيد الإلغاء'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
