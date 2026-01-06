// app/payment/page.tsx
'use client';

import { Suspense, use } from 'react';
import SimplePaymentContent from '@/components/SimplePaymentContent';

// app/[schoolId]/payment/page.tsx
export default function PaymentPage({ params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = use(params);
    return (
        <Suspense fallback={<div>加载支付页面...</div>}>
            <SimplePaymentContent schoolId={schoolId} />
        </Suspense>
    );
}