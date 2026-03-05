'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftOutlined, SwapOutlined, UndoOutlined } from '@ant-design/icons';
import { Typography, Tag, Card, Button, Empty, message, Modal, Input, InputNumber } from 'antd';
import { Picker, Divider } from 'antd-mobile';
import Footer from '@/components/Footer';
import axiosInstance from 'src/utils/axiosInstance';

const { Title, Text } = Typography;

const uniformTypeText: Record<number, string> = { 1: '夏季校服', 2: '春秋校服', 3: '冬季校服' };

const SIZES_OPTIONS = [
    ['145#', '150#', '155#', '160#', '165#', '170#', '175#', '180#', '185#', '190#', '195#'].map(s => ({ label: s, value: s }))
];

function formatAmount(val: any) {
    const num = Number(val);
    if (isNaN(num)) return '0.00';
    return (num / 100).toFixed(2);
}

export default function QueryDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = use(params);
    const router = useRouter();
    const [studentData, setStudentData] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Exchange modal state
    const [exchangeModal, setExchangeModal] = useState<{
        open: boolean;
        orderId: number;
        currentSize: string;
        maxQty: number;
        newSize: string;
        isSpecialSize: boolean;
        qty: number;
        height?: string;
        weight?: string;
    } | null>(null);
    const [pickerVisible, setPickerVisible] = useState(false);

    // Refund modal state
    const [refundModal, setRefundModal] = useState<{ open: boolean; orderId: number; maxQty: number; orderName: string } | null>(null);
    const [refundQty, setRefundQty] = useState(1);

    useEffect(() => {
        const data = sessionStorage.getItem('selectedStudent');
        if (data) setStudentData(JSON.parse(data));
    }, []);

    const updateOrderStatus = (orderId: number, orderStatus: string) => {
        setStudentData((prev: any) => ({
            ...prev,
            orders: prev.orders.map((o: any) =>
                o.order_id === orderId ? {
                    ...o,
                    order_status: orderStatus,
                    // If moving to an after-sales state, it must have been paid
                    payment_status: 1
                } : o
            )
        }));
    };

    const handleExchangeSubmit = async () => {
        if (!exchangeModal?.isSpecialSize && !exchangeModal?.newSize) {
            message.warning('请选择希望换成的尺码');
            return;
        }
        if (exchangeModal?.isSpecialSize && (!exchangeModal.height || !exchangeModal.weight)) {
            message.warning('请填写身高和体重信息');
            return;
        }

        setActionLoading(true);
        try {
            const order = studentData.orders.find((o: any) => o.order_id === exchangeModal?.orderId);
            const primaryItem = order?.items?.[0];
            await axiosInstance.post('/public/after-sales', {
                order_id: exchangeModal?.orderId,
                type: 'EXCHANGE',
                original_size: primaryItem?.size || '',
                new_size: exchangeModal?.isSpecialSize ? `特殊:${exchangeModal.height}cm/${exchangeModal.weight}斤` : exchangeModal?.newSize,
                is_special_size: exchangeModal?.isSpecialSize,
                height: exchangeModal?.height,
                weight: exchangeModal?.weight,
                original_quantity: primaryItem?.quantity ?? 1,
                new_quantity: exchangeModal?.qty || primaryItem?.quantity || 1,
            });
            message.success('调换申请已提交，请等待管理员处理');
            setExchangeModal(null);
            if (exchangeModal?.orderId) updateOrderStatus(exchangeModal.orderId, 'EXCHANGING');
        } catch (err: any) {
            message.error(err.message || '提交失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRefundSubmit = async () => {
        setActionLoading(true);
        try {
            const order = studentData.orders.find((o: any) => o.order_id === refundModal?.orderId);
            const primaryItem = order?.items?.[0];
            await axiosInstance.post('/public/after-sales', {
                order_id: refundModal?.orderId,
                type: 'REFUND',
                original_size: primaryItem?.size || '',
                original_quantity: primaryItem?.quantity ?? 1,
                new_quantity: refundQty,
            });
            message.success('退款申请已提交，请等待管理员处理');
            setRefundModal(null);
            if (refundModal?.orderId) updateOrderStatus(refundModal.orderId, 'REFUNDING');
        } catch (err: any) {
            message.error(err.message || '提交失败');
        } finally {
            setActionLoading(false);
        }
    };

    if (!studentData) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Empty description="无数据，请返回重新查询" />
                    <Button type="primary" className="mt-4" onClick={() => router.back()}>返回</Button>
                </div>
            </div>
        );
    }

    const { student, orders } = studentData;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-24">
            {/* Header */}
            <div className="bg-white px-6 py-4 flex items-center border-b sticky top-0 z-10 shadow-sm">
                <button onClick={() => router.back()} className="mr-4 text-gray-600 hover:text-blue-600 transition-colors">
                    <ArrowLeftOutlined style={{ fontSize: '20px' }} />
                </button>
                <Title level={4} style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>订单详情</Title>
            </div>

            <main className="flex-1 p-6 max-w-md mx-auto w-full">
                {/* Student Info Card — clean label/value grid, no icons */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 mb-6 shadow-xl shadow-blue-200">
                    <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-4">学生信息</div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        <div>
                            <div className="text-white/50 text-xs mb-0.5">姓名</div>
                            <div className="text-white font-bold text-base">{student.name || '—'}</div>
                        </div>
                        <div>
                            <div className="text-white/50 text-xs mb-0.5">手机号</div>
                            <div className="text-white font-bold text-base">{student.phone || '—'}</div>
                        </div>
                        <div>
                            <div className="text-white/50 text-xs mb-0.5">年级/班级</div>
                            <div className="text-white font-bold text-base">
                                {student.grade_name || ''} {student.class_name && student.class_name !== '未分班' ? student.class_name : (student.grade_name ? '' : '—')}
                            </div>
                        </div>
                        <div>
                            <div className="text-white/50 text-xs mb-0.5">出生日期</div>
                            <div className="text-white font-bold text-base">{student.birthday || '—'}</div>
                        </div>
                    </div>
                </div>

                {/* Orders */}
                <div className="mb-3">
                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                        订购清单 ({orders.length} 条)
                    </Text>
                </div>

                {orders.length > 0 ? (
                    <div className="space-y-6">
                        {orders.map((order: any, idx: number) => (
                            <Card key={order.order_id || idx} className="rounded-3xl border border-gray-100 shadow-lg" bodyStyle={{ padding: 0 }}>
                                {/* Order Header */}
                                <div className="px-6 py-4 flex justify-between items-center bg-gray-50/80 border-b border-gray-100 rounded-t-3xl">
                                    <div className="flex flex-col">
                                        <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">订单编号</Text>
                                        <Text strong className="text-sm font-mono text-gray-700">{order.order_no}</Text>
                                    </div>
                                    {order.order_status === 'REFUNDING' ? (
                                        <Tag color="orange" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">退款审核中</Tag>
                                    ) : order.order_status === 'EXCHANGING' ? (
                                        <Tag color="blue" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">调换审核中</Tag>
                                    ) : order.order_status === 'SHIPPED' ? (
                                        <Tag color="cyan" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">已发货</Tag>
                                    ) : order.order_status === 'REFUNDED' ? (
                                        <Tag color="error" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">已退款</Tag>
                                    ) : order.order_status === 'PARTIAL_REFUNDED' ? (
                                        <Tag color="purple" className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm">部分退款</Tag>
                                    ) : (
                                        <Tag
                                            color={(order.payment_status === 1 || order.order_status === 'PAID') ? 'success' : 'warning'}
                                            className="rounded-full border-none px-4 py-1 font-bold text-xs m-0 shadow-sm"
                                        >
                                            {(order.payment_status === 1 || order.order_status === 'PAID') ? '已付款' : '待付款'}
                                        </Tag>
                                    )}
                                </div>

                                {/* Order Items List */}
                                <div className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        {order.items.map((item: any, iidx: number) => (
                                            <div key={item.id || iidx} className="flex items-start gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                                    <span className="text-blue-600 font-bold text-lg">{uniformTypeText[item.uniform_type]?.[0] || '服'}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between">
                                                        <Text strong className="text-base text-gray-800">{uniformTypeText[item.uniform_type] || item.product_name}</Text>
                                                        {/* <Text strong className="text-gray-900">¥ {(Number(item.price) / 100).toFixed(2)}</Text> */}
                                                    </div>
                                                    <div className="flex gap-4 mt-2">
                                                        <div className="px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-500 font-medium">
                                                            尺码：{item.size || '以实际发放为准'}
                                                        </div>
                                                        <div className="px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-500 font-medium">
                                                            数量：{item.quantity} 套
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Order Summary */}
                                    <div className="flex justify-between items-center pt-2">
                                        <Text className="text-xs text-gray-400 font-bold uppercase tracking-widest">实付总金额</Text>
                                        <div className="text-right">
                                            <span className="text-xs mr-1 font-medium text-gray-800">¥</span>
                                            <span className="text-2xl font-black text-gray-900 tracking-tight">
                                                {formatAmount(order.total_amount)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {order.payment_status === 1 &&
                                        order.order_status !== 'REFUNDING' &&
                                        order.order_status !== 'EXCHANGING' &&
                                        order.order_status !== 'REFUNDED' && (
                                            <div className="flex flex-col gap-4 pt-6 mt-2 border-t border-dashed border-gray-100">
                                                {/* Item-level After-Sales Status Text */}
                                                {order.items.map((item: any, iidx: number) => (
                                                    <div key={`status-${iidx}`} className="space-y-1">
                                                        {item.refunded_quantity > 0 && (
                                                            <div className="text-[11px] text-purple-600 font-bold bg-purple-50 px-3 py-2 rounded-xl border border-purple-100">
                                                                已退款{uniformTypeText[item.uniform_type] || item.product_name}{item.refunded_quantity}套，退款金额：{(Number(item.refunded_amount || 0) / 100).toFixed(2)}元
                                                            </div>
                                                        )}
                                                        {(item.exchanges || []).map((ex: any, eidx: number) => (
                                                            <div key={`ex-${eidx}`} className="text-[11px] text-blue-600 font-bold bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">
                                                                已完成{uniformTypeText[item.uniform_type] || item.product_name}{ex.qty}套尺码调换，{ex.from} {'->'} {ex.to}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}

                                                <div className="flex gap-3">
                                                    {/* Exchange allowed for PAID and SHIPPED, controlled by admin switch and per-item processed status */}
                                                    {(order.order_status === 'PAID' || order.order_status === 'SHIPPED') &&
                                                        order.after_sales_config?.exchange_active !== false &&
                                                        order.items.some((item: any) => !(item.exchanges?.length > 0)) && (
                                                            <Button
                                                                block
                                                                icon={<SwapOutlined />}
                                                                className="rounded-2xl h-12 font-bold text-sm text-blue-600 bg-blue-50 border-none hover:bg-blue-100 transition-all"
                                                                onClick={() => {
                                                                    // Filter to items that haven't been exchanged yet
                                                                    const availableItem = order.items.find((item: any) => !(item.exchanges?.length > 0)) || order.items[0];
                                                                    setExchangeModal({
                                                                        open: true,
                                                                        orderId: order.order_id || order.id,
                                                                        currentSize: availableItem?.size,
                                                                        maxQty: availableItem?.quantity,
                                                                        qty: availableItem?.quantity || 1,
                                                                        newSize: '160#',
                                                                        isSpecialSize: false
                                                                    });
                                                                }}
                                                            >
                                                                申请调换
                                                            </Button>
                                                        )}
                                                    {/* Refund ONLY allowed for PAID (not SHIPPED), controlled by admin switch and remaining quantity */}
                                                    {order.order_status === 'PAID' &&
                                                        order.after_sales_config?.refund_active !== false &&
                                                        order.items.some((item: any) => (item.quantity - (item.refunded_quantity || 0)) > 0) && (
                                                            <Button
                                                                block
                                                                danger
                                                                icon={<UndoOutlined />}
                                                                className="rounded-2xl h-12 font-bold text-sm bg-red-50 border-none hover:bg-red-100 transition-all"
                                                                onClick={() => {
                                                                    // Find first item with remaining quantity
                                                                    const availableItem = order.items.find((item: any) => (item.quantity - (item.refunded_quantity || 0)) > 0) || order.items[0];
                                                                    const remainingQty = (availableItem?.quantity || 1) - (availableItem?.refunded_quantity || 0);
                                                                    setRefundQty(remainingQty > 0 ? 1 : 0);
                                                                    setRefundModal({
                                                                        open: true,
                                                                        orderId: order.order_id || order.id,
                                                                        maxQty: remainingQty,
                                                                        orderName: uniformTypeText[availableItem.uniform_type] || availableItem.product_name
                                                                    });
                                                                }}
                                                            >
                                                                申请退款
                                                            </Button>
                                                        )}
                                                </div>
                                            </div>
                                        )}
                                    {(order.order_status === 'REFUNDING' || order.order_status === 'EXCHANGING') && (
                                        <div className="mt-4 pt-4 border-t border-dashed border-gray-100 text-center">
                                            <Text type="secondary" className="text-xs">
                                                {order.order_status === 'REFUNDING'
                                                    ? '🕐 退款申请已提交，等待管理员审核，审核完成后将退款至原账户'
                                                    : '🕐 调换申请已提交，等待管理员联系处理'}
                                            </Text>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 bg-white rounded-[40px] shadow-sm flex flex-col items-center border border-gray-100">
                        <Empty description={<span className="text-gray-400 font-medium">暂无订购记录</span>} />
                        <Button type="primary" className="mt-6 rounded-2xl h-12 px-8 font-bold" onClick={() => router.back()}>返回查询</Button>
                    </div>
                )}
            </main>

            {/* Exchange Modal */}
            <Modal
                title={<span className="font-bold">申请调换尺码</span>}
                open={!!exchangeModal?.open}
                onOk={handleExchangeSubmit}
                onCancel={() => setExchangeModal(null)}
                confirmLoading={actionLoading}
                okText="提交申请"
                cancelText="取消"
                className="premium-modal"
                bodyStyle={{ padding: '12px 24px 24px' }}
            >
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex flex-col">
                            <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider mb-0.5">当前在用尺码</Text>
                            <Text className="text-gray-800 font-black text-lg">{exchangeModal?.currentSize || '未知'}</Text>
                        </div>
                        <SwapOutlined className="text-gray-300 text-xl" />
                        <div className="flex flex-col text-right">
                            <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider mb-0.5">目标换货尺码</Text>
                            <Text className="text-blue-600 font-black text-lg">
                                {exchangeModal?.isSpecialSize
                                    ? (exchangeModal.height && exchangeModal.weight ? `${exchangeModal.height}cm/${exchangeModal.weight}斤` : '待填写')
                                    : (exchangeModal?.newSize || '未选择')}
                            </Text>
                        </div>
                    </div>

                    <div>
                        <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                            <button
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${!exchangeModal?.isSpecialSize ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                onClick={() => setExchangeModal(prev => prev ? { ...prev, isSpecialSize: false } : null)}
                            >
                                常规尺码
                            </button>
                            <button
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${exchangeModal?.isSpecialSize ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                onClick={() => setExchangeModal(prev => prev ? { ...prev, isSpecialSize: true } : null)}
                            >
                                特殊尺码
                            </button>
                        </div>

                        {exchangeModal?.isSpecialSize ? (
                            <div className="flex gap-4 animate-fadeIn">
                                <div className="flex-1">
                                    <Text type="secondary" style={{ fontSize: '11px' }} className="block mb-1 px-1 font-bold uppercase">身高 (cm)</Text>
                                    <Input
                                        type="number"
                                        className="w-full bg-gray-50 border-none rounded-xl h-12 px-4 text-sm font-bold focus:ring-1 focus:ring-blue-400 outline-none"
                                        placeholder="如 165"
                                        value={exchangeModal.height || ''}
                                        onChange={(e) => setExchangeModal(prev => prev ? { ...prev, height: e.target.value } : null)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Text type="secondary" style={{ fontSize: '11px' }} className="block mb-1 px-1 font-bold uppercase">体重 (斤)</Text>
                                    <Input
                                        type="number"
                                        className="w-full bg-gray-50 border-none rounded-xl h-12 px-4 text-sm font-bold focus:ring-1 focus:ring-blue-400 outline-none"
                                        placeholder="如 110"
                                        value={exchangeModal.weight || ''}
                                        onChange={(e) => setExchangeModal(prev => prev ? { ...prev, weight: e.target.value } : null)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div
                                className="flex items-center justify-between bg-blue-50/50 p-5 rounded-2xl border border-blue-100 active:scale-[0.98] transition-all cursor-pointer"
                                onClick={() => setPickerVisible(true)}
                            >
                                <div className="flex flex-col">
                                    <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider mb-0.5">选择标准号段</Text>
                                    <Text className="text-blue-600 font-black text-xl">{exchangeModal?.newSize || '160#'}</Text>
                                </div>
                                <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                                    <SwapOutlined className="rotate-90" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <Text type="secondary" style={{ fontSize: '11px' }} className="block mb-2 px-1 font-bold uppercase">换货套数 (最大 {exchangeModal?.maxQty || 1} 套)</Text>
                        <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                            <InputNumber
                                min={1}
                                max={exchangeModal?.maxQty || 1}
                                value={exchangeModal?.qty}
                                onChange={(v) => setExchangeModal(prev => prev ? { ...prev, qty: v || 1 } : null)}
                                size="large"
                                className="w-full rounded-xl border-none bg-transparent"
                            />
                            <Text className="text-gray-400 font-bold pr-2">套</Text>
                        </div>
                    </div>
                </div>

                <Picker
                    columns={SIZES_OPTIONS}
                    visible={pickerVisible}
                    onClose={() => setPickerVisible(false)}
                    value={[exchangeModal?.newSize || '160#']}
                    onConfirm={v => {
                        setExchangeModal(prev => prev ? { ...prev, newSize: v[0] as string } : null);
                        setPickerVisible(false);
                    }}
                />
            </Modal>

            {/* Refund Modal */}
            <Modal
                title="申请退款"
                open={!!refundModal?.open}
                onOk={handleRefundSubmit}
                onCancel={() => setRefundModal(null)}
                confirmLoading={actionLoading}
                okText="确认申请退款"
                okButtonProps={{ danger: true }}
                cancelText="取消"
            >
                <div className="py-4 space-y-5">
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-700 leading-relaxed">
                        退款申请提交后，管理员审核通过后将退款至原支付账户，审核期间无法再次申请。
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <Text type="secondary" className="text-sm">退款商品</Text>
                        <Text strong>{refundModal?.orderName}</Text>
                    </div>
                    <div>
                        <Text type="secondary" className="text-sm block mb-3">
                            申请退款套数（剩余可退 {refundModal?.maxQty} 套）
                        </Text>
                        <div className="flex items-center gap-4">
                            <InputNumber
                                min={1}
                                max={refundModal?.maxQty || 1}
                                value={refundQty}
                                onChange={(v) => setRefundQty(v || 1)}
                                size="large"
                                className="w-32 rounded-xl"
                            />
                            <Text type="secondary" className="text-sm">套</Text>
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {Array.from({ length: refundModal?.maxQty || 1 }, (_, i) => i + 1).map(n => (
                                <button
                                    key={n}
                                    onClick={() => setRefundQty(n)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${refundQty === n
                                        ? 'bg-red-500 text-white border-red-500'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                                        }`}
                                >
                                    {n} 套
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            <Footer />
        </div>
    );
}
