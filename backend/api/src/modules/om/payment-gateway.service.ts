import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import { OM_PAYMENT_GATEWAY_MODES } from './constants/om-billing-catalog';

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly config: ConfigService) {}

  getConfig() {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID', '').trim();
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET', '').trim();
    const demo = !keyId || !keySecret;

    return {
      provider: 'razorpay' as const,
      keyId: demo ? 'rzp_demo' : keyId,
      demo,
      currency: 'INR',
      gatewayModes: OM_PAYMENT_GATEWAY_MODES,
      merchantName: this.config.get<string>('PAYMENT_GATEWAY_MERCHANT_NAME', 'Uttarakhand Jal Sansthan'),
    };
  }

  isGatewayMode(mode: string) {
    return OM_PAYMENT_GATEWAY_MODES.includes(mode as (typeof OM_PAYMENT_GATEWAY_MODES)[number]);
  }

  async createOrder(input: {
    amount: number;
    consumerId: string;
    billId?: string;
    paymentMode: string;
    consumerLabel?: string;
  }) {
    if (!this.isGatewayMode(input.paymentMode)) {
      throw new BadRequestException('Selected payment mode does not use the payment gateway');
    }
    if (input.amount < 1) throw new BadRequestException('Minimum payment amount is ₹1');

    const cfg = this.getConfig();
    const amountPaise = Math.round(input.amount * 100);
    const receipt = `egip_mb_${Date.now()}`;

    if (cfg.demo) {
      return {
        ...cfg,
        orderId: `order_demo_${randomBytes(8).toString('hex')}`,
        amount: amountPaise,
        amountInr: input.amount,
        receipt,
        paymentMode: input.paymentMode,
        consumerId: input.consumerId,
        billId: input.billId ?? null,
        consumerLabel: input.consumerLabel ?? null,
      };
    }

    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET', '').trim();
    const auth = Buffer.from(`${cfg.keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          consumerId: input.consumerId,
          billId: input.billId ?? '',
          paymentMode: input.paymentMode,
          consumerLabel: input.consumerLabel ?? '',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new BadRequestException(`Payment gateway order failed: ${errText}`);
    }

    const order = await response.json() as { id: string; amount: number; currency: string; receipt?: string };
    return {
      ...cfg,
      orderId: order.id,
      amount: order.amount,
      amountInr: input.amount,
      receipt: order.receipt ?? receipt,
      paymentMode: input.paymentMode,
      consumerId: input.consumerId,
      billId: input.billId ?? null,
      consumerLabel: input.consumerLabel ?? null,
    };
  }

  verifySignature(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const cfg = this.getConfig();

    if (cfg.demo) {
      if (
        !input.razorpayOrderId.startsWith('order_demo_')
        || !input.razorpayPaymentId.startsWith('pay_demo_')
        || input.razorpaySignature !== 'demo_signature'
      ) {
        throw new BadRequestException('Demo payment verification failed');
      }
      return {
        verified: true,
        transactionRef: input.razorpayPaymentId,
        gatewayOrderId: input.razorpayOrderId,
        provider: cfg.provider,
        demo: true,
      };
    }

    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET', '').trim();
    const expected = createHmac('sha256', keySecret)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest('hex');

    if (expected !== input.razorpaySignature) {
      throw new BadRequestException('Payment signature verification failed');
    }

    return {
      verified: true,
      transactionRef: input.razorpayPaymentId,
      gatewayOrderId: input.razorpayOrderId,
      provider: cfg.provider,
      demo: false,
    };
  }
}
