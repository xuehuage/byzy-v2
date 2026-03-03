'use client';

import { useState, use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Button, Typography, Card, Modal,
    message
} from 'antd';
import {
    Picker,
    Stepper,
    Image,
    Divider
} from 'antd-mobile';
import {
    InfoCircleOutlined,
    EnvironmentOutlined,
    ArrowLeftOutlined,
    RightOutlined
} from '@ant-design/icons';
import { fetchPublicSchoolDetail, createOrderV2 } from '@/api/studentApi';
import Footer from '@/components/Footer';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const SIZES_OPTIONS = [
    ['145#', '150#', '155#', '160#', '165#', '170#', '175#', '180#', '185#', '190#', '195#'].map(s => ({ label: s, value: s }))
];

export default function OrderPage({ params }: { params: Promise<{ schoolId: string }> }) {
    const { schoolId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Student Info from URL
    const name = searchParams.get('name') || '';
    const phone = searchParams.get('phone') || '';
    const birthday = searchParams.get('birthday') || '';

    const [schoolConfig, setSchoolConfig] = useState<any>(null);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
    const [activePicker, setActivePicker] = useState<number | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'2' | '3'>('3'); // '2'=Alipay, '3'=WeChat

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetchPublicSchoolDetail(Number(schoolId));
                if (res.code === 200) {
                    const config = res.data;
                    setSchoolConfig(config);

                    // Default all active items to quantity 2
                    const initialItems: any[] = [];
                    if (config.isSummerActive) {
                        initialItems.push({ uniformType: 1, price: config.summerPrice, quantity: 2, size: '160#', isSpecialSize: false });
                    }
                    if (config.isAutumnActive) {
                        initialItems.push({ uniformType: 2, price: config.autumnPrice, quantity: 2, size: '160#', isSpecialSize: false });
                    }
                    if (config.isWinterActive) {
                        initialItems.push({ uniformType: 3, price: config.winterPrice, quantity: 2, size: '160#', isSpecialSize: false });
                    }
                    setSelectedItems(initialItems);
                }
            } catch (error) {
                message.error('获取学校配置失败');
            }
        };
        fetchConfig();
    }, [schoolId]);

    const updateItem = (type: number, field: string, value: any) => {
        setSelectedItems(items => items.map(i =>
            i.uniformType === type ? { ...i, [field]: value } : i
        ));
    };

    const calculateTotal = () => {
        return selectedItems.reduce((acc, i) => acc + i.price * i.quantity, 0) / 100;
    };

    const handleSubmit = async () => {
        const validItems = selectedItems.filter(i => i.quantity > 0);

        if (validItems.length === 0) {
            message.warning('请至少选择一套校服数量');
            return;
        }

        // Validation for special sizes
        for (const item of validItems) {
            if (item.isSpecialSize) {
                if (!item.height || !item.weight) {
                    message.warning('由于您选择了特殊尺码，请填写具体的身高和体重信息');
                    return;
                }
            }
        }

        setLoading(true);
        try {
            const payload = {
                schoolId: Number(schoolId),
                name,
                phone,
                birthday,
                items: validItems
            };
            const res = await createOrderV2(payload);
            if (res.code === 200) {
                message.success('预约申请已创建');
                router.push(`/${schoolId}/payment?method=${paymentMethod}&tempOrderId=${res.data.orderId}`);
            }
        } catch (error: any) {
            message.error(error.message || '提交失败');
        } finally {
            setLoading(false);
        }
    };

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api').replace('/api', '');

    const renderProductCard = (typeLabel: string, type: number, image: string, price: number, active: boolean) => {
        if (!active) return null;
        const schoolName = schoolConfig?.name || '学校';
        const productTitle = `${schoolName}${typeLabel}`;
        const itemInfo = selectedItems.find(i => i.uniformType === type);
        if (!itemInfo) return null;

        return (
            <Card
                key={type}
                className="mb-8 rounded-[2rem] overflow-hidden border-none shadow-xl shadow-gray-200/50 bg-white animate-fadeIn"
                bodyStyle={{ padding: 0 }}
            >
                {/* Image Container */}
                <div className="relative w-full aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
                    {image ? (
                        <Image
                            src={`${apiBase}${image}`}
                            alt={productTitle}
                            fit="contain"
                            className="w-full h-full"
                        />
                    ) : (
                        <div className="text-gray-300 text-sm">暂无展示图片</div>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    <Title level={4} style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 800 }}>{productTitle}</Title>

                    <div className="space-y-6">
                        {/* Price Row */}
                        <div className="flex items-center justify-between">
                            <Text type="secondary" className="font-medium">单价 (¥)</Text>
                            <Text strong className="text-red-500 text-xl font-black">¥{(price / 100).toFixed(0)}</Text>
                        </div>

                        {/* Quantity Row */}
                        <div className="flex items-center justify-between">
                            <Text type="secondary" className="font-medium">订购套数</Text>
                            <Stepper
                                value={itemInfo.quantity}
                                min={0}
                                max={10}
                                onChange={(val) => updateItem(type, 'quantity', val)}
                                style={{
                                    '--button-background-color': '#f3f4f6',
                                    '--button-text-color': '#1f2937',
                                    '--input-background-color': 'transparent',
                                    '--button-font-size': '18px',
                                    '--input-width': '40px'
                                }}
                            />
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        {/* Size Selection Area */}
                        <div>
                            <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                                <button
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${!itemInfo.isSpecialSize ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                    onClick={() => updateItem(type, 'isSpecialSize', false)}
                                >
                                    选择尺码
                                </button>
                                <button
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${itemInfo.isSpecialSize ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                    onClick={() => updateItem(type, 'isSpecialSize', true)}
                                >
                                    特殊尺码
                                </button>
                            </div>

                            {itemInfo.isSpecialSize ? (
                                <div className="flex gap-4 animate-fadeIn">
                                    <div className="flex-1">
                                        <Text type="secondary" style={{ fontSize: '11px' }} className="block mb-1 px-1">身高 (cm)</Text>
                                        <input
                                            type="number"
                                            className="w-full bg-gray-50 border-none rounded-xl h-10 px-3 text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                                            placeholder="如 165"
                                            value={itemInfo.height || ''}
                                            onChange={(e) => updateItem(type, 'height', e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Text type="secondary" style={{ fontSize: '11px' }} className="block mb-1 px-1">体重 (斤)</Text>
                                        <input
                                            type="number"
                                            className="w-full bg-gray-50 border-none rounded-xl h-10 px-3 text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                                            placeholder="如 110"
                                            value={itemInfo.weight || ''}
                                            onChange={(e) => updateItem(type, 'weight', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="flex items-center justify-between bg-blue-50/50 p-4 rounded-2xl border border-blue-100 active:scale-[0.98] transition-all"
                                    onClick={() => setActivePicker(type)}
                                >
                                    <div className="flex flex-col">
                                        <Text type="secondary" style={{ fontSize: '11px' }} className="uppercase font-bold tracking-wider">标准号段</Text>
                                        <Text className="text-blue-600 font-black text-lg">{itemInfo.size}</Text>
                                    </div>
                                    <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                                        <RightOutlined style={{ fontSize: '12px' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Picker
                    columns={SIZES_OPTIONS}
                    visible={activePicker === type}
                    onClose={() => setActivePicker(null)}
                    value={[itemInfo.size || '160#']}
                    onConfirm={v => {
                        updateItem(type, 'size', v[0]);
                        setActivePicker(null);
                    }}
                />
            </Card>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-32">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b sticky top-0 z-10 transition-all">
                <div className="flex items-center">
                    <button onClick={() => router.back()} className="mr-4 text-gray-800 hover:text-blue-600 transition-colors">
                        <ArrowLeftOutlined style={{ fontSize: '20px' }} />
                    </button>
                    <Title level={4} style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>在线订购</Title>
                </div>
                <button
                    onClick={() => setIsSizeGuideOpen(true)}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                >
                    <InfoCircleOutlined style={{ fontSize: '20px' }} />
                </button>
            </div>

            <main className="p-6 max-w-md mx-auto w-full">
                {schoolConfig?.sizeGuideImage ? (
                    <div className="mb-8 rounded-[2rem] overflow-hidden shadow-xl shadow-blue-100 ring-1 ring-blue-50 bg-white">
                        <Image
                            src={`${apiBase}${schoolConfig.sizeGuideImage}`}
                            alt="尺码参考表"
                            className="w-full h-auto"
                        />
                    </div>
                ) : (
                    <div className="mb-8 p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 text-center">
                        <Text type="secondary" className="font-medium text-blue-600/60">尺码预览加载中 or 暂未上传</Text>
                    </div>
                )}

                <Divider className="mb-8 font-bold text-gray-400 text-xs">可用订购款式 ({schoolConfig ? ((schoolConfig.isSummerActive ? 1 : 0) + (schoolConfig.isAutumnActive ? 1 : 0) + (schoolConfig.isWinterActive ? 1 : 0)) : 0})</Divider>

                {schoolConfig ? (
                    <div className="animate-fadeIn">
                        {renderProductCard('夏季校服 (短袖套装)', 1, schoolConfig.summerImage, schoolConfig.summerPrice, !!schoolConfig.isSummerActive)}
                        {renderProductCard('春秋校服 (长袖套装)', 2, schoolConfig.autumnImage, schoolConfig.autumnPrice, !!schoolConfig.isAutumnActive)}
                        {renderProductCard('冬季校服 (防寒外套)', 3, schoolConfig.winterImage, schoolConfig.winterPrice, !!schoolConfig.isWinterActive)}

                        {(!schoolConfig.isSummerActive && !schoolConfig.isAutumnActive && !schoolConfig.isWinterActive) && (
                            <div className="py-20 text-center flex flex-col items-center">
                                <div className="text-6xl mb-4 text-gray-200 tracking-tighter">OFF</div>
                                <Text type="secondary" className="font-medium">当前校园店暂无可订购款式</Text>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-20 text-center flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                        <Text type="secondary" className="text-sm font-medium">全力加载配置中...</Text>
                    </div>
                )}
            </main>

            {/* Bottom Floating Bar */}
            <div className={`fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t px-6 py-4 ring-1 ring-black/5 shadow-[0_-20px_50px_rgba(0,0,0,0.08)] z-20 transition-all duration-700 ${selectedItems.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>

                {/* Payment Method Selector */}
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-widest whitespace-nowrap">支付方式</span>
                    <div className="flex gap-2 flex-1">
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('3')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[1rem] border-2 text-sm font-bold transition-all ${paymentMethod === '3'
                                ? 'border-green-500 bg-green-50 text-green-700 shadow-sm shadow-green-200'
                                : 'border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-600'
                                }`}
                        >
                            <img src="/icons/wechat-pay.svg" alt="微信支付" className="w-5 h-5" />
                            微信支付
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('2')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-[1rem] border-2 text-sm font-bold transition-all ${paymentMethod === '2'
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-200'
                                : 'border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600'
                                }`}
                        >
                            <img src="/icons/alipay.svg" alt="支付宝" className="w-5 h-5" />
                            支付宝
                        </button>
                    </div>
                </div>

                {/* Total + Submit Row */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">应付总计</span>
                        <div className="text-3xl font-black text-red-500 tracking-tighter flex items-end">
                            <span className="text-sm mb-1 mr-0.5 font-bold">￥</span>
                            {calculateTotal().toFixed(0)}
                        </div>
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        loading={loading}
                        onClick={handleSubmit}
                        className="h-16 px-10 rounded-[1.25rem] font-black text-lg border-none bg-blue-600 shadow-2xl shadow-blue-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        立即下单
                    </Button>
                </div>
            </div>

            {/* Size Guide Modal */}
            <Modal
                title={<span className="text-lg font-black tracking-tight">尺码对照与说明</span>}
                open={isSizeGuideOpen}
                onCancel={() => setIsSizeGuideOpen(false)}
                footer={null}
                width={500}
                centered
                bodyStyle={{ padding: '0 24px 32px' }}
                className="premium-modal"
            >
                <div className="mt-4">
                    {schoolConfig?.sizeGuideImage ? (
                        <div className="rounded-3xl overflow-hidden border-4 border-gray-50 shadow-inner">
                            <img src={`${apiBase}${schoolConfig.sizeGuideImage}`} alt="尺码参考图" className="w-full h-auto" />
                        </div>
                    ) : (
                        <div className="py-20 text-center bg-gray-50 rounded-3xl text-gray-400 font-medium">暂未上传尺码参考图</div>
                    )}
                    <div className="mt-6 p-5 bg-blue-50/50 border border-blue-100 rounded-[1.5rem] relative overflow-hidden">
                        <div className="absolute right-[-10px] top-[-10px] text-4xl opacity-5 text-blue-600"><InfoCircleOutlined /></div>
                        <div className="flex gap-2 text-blue-800 font-black text-[11px] uppercase tracking-widest mb-1 items-center">
                            <div className="w-1 h-1 bg-blue-600 rounded-full"></div> 选码建议
                        </div>
                        <p className="text-blue-700/80 text-xs leading-relaxed font-medium">
                            建议根据学生实际身高向上选择（如身高156cm建议选择160#）。如果您的孩子体型偏胖，建议再额外增加半档或一档。
                        </p>
                    </div>
                </div>
            </Modal>

            <Footer />
        </div>
    );
}
