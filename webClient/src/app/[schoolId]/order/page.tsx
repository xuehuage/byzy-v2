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
    Divider,
    Popup,
    Radio,
    Space
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
    const gradeId = searchParams.get('gradeId') || '';
    const classId = searchParams.get('classId') || '';

    const [schoolConfig, setSchoolConfig] = useState<any>(null);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
    const [activePicker, setActivePicker] = useState<number | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'2' | '3'>('3'); // '2'=Alipay, '3'=WeChat
    const [isPaymentPopupOpen, setIsPaymentPopupOpen] = useState(false);

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

    const handleOrderNow = () => {
        const validItems = selectedItems.filter(i => i.quantity > 0);

        if (validItems.length === 0) {
            message.warning('请至少选择一套校服数量');
            return;
        }

        // Validation for special sizes
        for (const item of validItems) {
            if (item.isSpecialSize) {
                if (!item.height || !item.weight) {
                    message.warning('由于您选择了具体的身高和体重信息');
                    return;
                }
            }
        }

        setIsPaymentPopupOpen(true);
    };

    const handleFinalSubmit = async () => {
        const validItems = selectedItems.filter(i => i.quantity > 0);
        setLoading(true);
        try {
            const payload = {
                schoolId: Number(schoolId),
                gradeId: gradeId ? Number(gradeId) : undefined,
                classId: classId ? Number(classId) : undefined,
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

                        {(schoolConfig.isSummerActive || schoolConfig.isAutumnActive || schoolConfig.isWinterActive) && (
                            <div className="mt-12 px-2">
                                <Button
                                    type="primary"
                                    block
                                    size="large"
                                    onClick={handleOrderNow}
                                    className="h-16 rounded-[1.25rem] font-black text-xl border-none bg-blue-600 shadow-2xl shadow-blue-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    立即下单
                                </Button>
                                <div className="mt-4 text-center">
                                    <Text type="secondary" style={{ fontSize: '11px' }} className="font-bold text-gray-400 uppercase tracking-widest">
                                        支持多种支付方式 · 安全加密 · 极速配送
                                    </Text>
                                </div>
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

            {/* Hidden Bottom Floating Bar (Replaced by Popup and Bottom Button) */}
            {false && (
                <div className={`fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t px-6 py-4 ring-1 ring-black/5 shadow-[0_-20px_50px_rgba(0,0,0,0.08)] z-20 transition-all duration-700 ${selectedItems.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
                    {/* Previous Bottom Bar Content */}
                </div>
            )}

            {/* Payment Selection Popup */}
            <Popup
                visible={isPaymentPopupOpen}
                onMaskClick={() => setIsPaymentPopupOpen(false)}
                onClose={() => setIsPaymentPopupOpen(false)}
                bodyStyle={{
                    borderTopLeftRadius: '2rem',
                    borderTopRightRadius: '2rem',
                    minHeight: '40vh',
                }}
            >
                <div className="p-8 font-sans">
                    <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
                    {/* 
                    <div className="mb-10 text-center animate-fadeIn">
                        <span className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] block mb-2">订单总计</span>
                        <div className="flex items-center justify-center gap-1">
                            <span className="text-red-500 text-2xl font-black">¥</span>
                            <span className="text-red-500 text-5xl font-black tracking-tighter">{calculateTotal().toFixed(2)}</span>
                        </div>
                    </div> */}

                    <div className="space-y-6 mb-10">

                        <div className="space-y-3">
                            <span className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] ml-2">支付方式</span>
                            <Radio.Group
                                value={paymentMethod}
                                onChange={val => setPaymentMethod(val as any)}
                            >
                                <Space direction='vertical' block className="w-full">
                                    <div
                                        onClick={() => setPaymentMethod('3')}
                                        className={`flex items-center justify-between p-5 rounded-[1.25rem] border-2 transition-all cursor-pointer ${paymentMethod === '3' ? 'border-green-500 bg-green-50/50' : 'border-gray-50 bg-gray-50/30 grayscale opacity-60'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center p-2">
                                                <img src="/icons/wechat-pay.svg" alt="微信支付" className="w-full h-full" />
                                            </div>
                                            <div>
                                                <div className="font-black text-gray-800">微信支付</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">Safe & Faster</div>
                                            </div>
                                        </div>
                                        <Radio value='3' />
                                    </div>

                                    <div
                                        onClick={() => setPaymentMethod('2')}
                                        className={`flex items-center justify-between p-5 rounded-[1.25rem] border-2 transition-all cursor-pointer ${paymentMethod === '2' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-50 bg-gray-50/30 grayscale opacity-60'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center p-2">
                                                <img src="/icons/alipay.svg" alt="支付宝" className="w-full h-full" />
                                            </div>
                                            <div>
                                                <div className="font-black text-gray-800">支付宝</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase">Official Payment</div>
                                            </div>
                                        </div>
                                        <Radio value='2' />
                                    </div>
                                </Space>
                            </Radio.Group>
                        </div>
                    </div>

                    <Button
                        type="primary"
                        block
                        size="large"
                        loading={loading}
                        onClick={handleFinalSubmit}
                        className="h-16 rounded-2xl font-black text-xl border-none bg-blue-600 shadow-xl shadow-blue-400/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
                    >
                        去支付
                    </Button>
                </div>
            </Popup>

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
