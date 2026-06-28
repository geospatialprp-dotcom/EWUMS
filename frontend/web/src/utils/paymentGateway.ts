export type PaymentGatewayOrder = {
  provider: 'razorpay';
  keyId: string;
  demo: boolean;
  currency: string;
  orderId: string;
  amount: number;
  amountInr?: number;
  receipt: string;
  paymentMode: string;
  merchantName?: string;
  consumerLabel?: string | null;
};

export type PaymentGatewayResult = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; contact?: string };
  theme?: { color?: string };
  method?: { upi?: boolean; card?: boolean; netbanking?: boolean };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function razorpayMethodFlags(mode: string): RazorpayCheckoutOptions['method'] {
  if (mode === 'upi' || mode === 'qr_code') return { upi: true, card: false, netbanking: false };
  if (mode === 'net_banking') return { netbanking: true, upi: false, card: false };
  if (mode === 'debit_card' || mode === 'credit_card') return { card: true, upi: false, netbanking: false };
  return undefined;
}

export function openDemoPaymentGateway(order: PaymentGatewayOrder): Promise<PaymentGatewayResult> {
  return new Promise((resolve, reject) => {
    const eventName = 'egip-demo-gateway-result';
    const onResult = (event: Event) => {
      window.removeEventListener(eventName, onResult as EventListener);
      const detail = (event as CustomEvent<PaymentGatewayResult | { cancelled: true }>).detail;
      if ('cancelled' in detail) {
        reject(new Error('Payment cancelled'));
        return;
      }
      resolve(detail);
    };
    window.addEventListener(eventName, onResult as EventListener);
    window.dispatchEvent(new CustomEvent('egip-open-demo-gateway', { detail: order }));
  });
}

export function emitDemoPaymentGatewayResult(result: PaymentGatewayResult | { cancelled: true }) {
  window.dispatchEvent(new CustomEvent('egip-demo-gateway-result', { detail: result }));
}

export async function openPaymentGatewayCheckout(
  order: PaymentGatewayOrder,
  consumerLabel?: string,
): Promise<PaymentGatewayResult> {
  if (order.demo) {
    return openDemoPaymentGateway(order);
  }

  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error('Payment gateway could not be loaded. Check your internet connection.');
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.merchantName ?? 'Uttarakhand Jal Sansthan',
      description: `Water bill collection · ${consumerLabel ?? 'Consumer'}`,
      order_id: order.orderId,
      prefill: { name: consumerLabel ?? undefined },
      theme: { color: '#0d9488' },
      method: razorpayMethodFlags(order.paymentMode),
      handler: (response) => {
        resolve({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.open();
  });
}

export function formatGatewayAmount(amountPaise: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(amountPaise / 100);
}
