import React, { useState, useEffect } from 'react';
import {
    Button, Tag, Modal, Form, Upload, message, Switch, Radio, Input,
    Image, Card, Row, Col, Select, InputNumber, Typography, Divider
} from 'antd';
import {
    EditOutlined, UploadOutlined, PictureOutlined,
    ShopOutlined
} from '@ant-design/icons';
import { getSchoolStats, getSchoolConfig, updateSchoolConfig, uploadImage } from '../services/api';
import type { SchoolStats, SchoolConfig } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;
const IMG_BASE = '/api';

const ProductConfig: React.FC = () => {
    const [schools, setSchools] = useState<SchoolStats[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
    const [config, setConfig] = useState<SchoolConfig | null>(null);

    // Category config modal
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<{
        title: string,
        imgField: string,
        activeField: string,
        priceField: string
    } | null>(null);
    const [configForm] = Form.useForm();

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const res = await getSchoolStats();
            if (res.data.code === 200) {
                setSchools(res.data.data);
                if (res.data.data.length > 0 && !selectedSchoolId) {
                    setSelectedSchoolId(res.data.data[0].id);
                }
            }
        } catch (error) {
            message.error('获取学校列表失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async (schoolId: number) => {
        try {
            const res = await getSchoolConfig(schoolId);
            if (res.data.code === 200) {
                setConfig(res.data.data);
            }
        } catch (error) {
            message.error('获取学校配置失败');
        }
    };

    useEffect(() => {
        fetchSchools();
    }, []);

    useEffect(() => {
        if (selectedSchoolId) {
            fetchConfig(selectedSchoolId);
        }
    }, [selectedSchoolId]);

    const handleUploadLocal = async (file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await uploadImage(formData);
            if (res.data.code === 200) {
                configForm.setFieldsValue({ newImagePath: res.data.data.url });
                message.success('图片上传成功');
            }
        } catch (error) {
            message.error('上传失败');
        }
    };

    const handleUploadSizeGuide = async (file: File) => {
        if (!selectedSchoolId) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await uploadImage(formData);
            if (res.data.code === 200) {
                const path = res.data.data.url;
                const newConfig = { ...config!, sizeGuideImage: path };
                setConfig(newConfig);
                await updateSchoolConfig(selectedSchoolId, { sizeGuideImage: path });
                message.success('尺码参考图更新成功');
            }
        } catch (error) {
            message.error('上传失败');
        }
    };

    const handleOpenConfigModal = (title: string, imgField: string, activeField: string, priceField: string) => {
        if (!config) return;
        const currentImg = config[imgField as keyof SchoolConfig] as string;
        setEditingCategory({ title, imgField, activeField, priceField });
        configForm.setFieldsValue({
            price: (config[priceField as keyof SchoolConfig] as number || 0) / 100,
            active: !!config[activeField as keyof SchoolConfig],
            imageMode: currentImg ? 'original' : 'new',
            newImagePath: ''
        });
        setIsConfigModalOpen(true);
    };

    const handleSaveConfig = async () => {
        if (!selectedSchoolId || !config || !editingCategory) return;
        try {
            const values = await configForm.validateFields();
            const priceCents = Math.round(values.price * 100);

            let finalImagePath = config[editingCategory.imgField as keyof SchoolConfig] as string;
            if (values.imageMode === 'new' && values.newImagePath) {
                finalImagePath = values.newImagePath;
            }

            const updateObj = {
                [editingCategory.priceField]: priceCents,
                [editingCategory.activeField]: values.active,
                [editingCategory.imgField]: finalImagePath
            };

            const newConfig = { ...config, ...updateObj };
            setConfig(newConfig as SchoolConfig);

            await updateSchoolConfig(selectedSchoolId, updateObj);
            setIsConfigModalOpen(false);
            message.success('保存配置成功');
        } catch (error) {
            message.error('保存失败');
        }
    };

    const renderProductCard = (title: string, imgField: keyof SchoolConfig, activeField: keyof SchoolConfig, priceField: keyof SchoolConfig) => {
        const isActive = config?.[activeField] as boolean;
        const imgUrl = config?.[imgField] as string;
        const priceCents = (config?.[priceField] as number) || 0;

        return (
            <Card
                className="product-config-card"
                style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                bodyStyle={{ padding: '0' }}
            >
                {/* Image Area */}
                <div style={{ position: 'relative', height: '240px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {imgUrl ? (
                        <div className="w-full h-full flex items-center justify-center p-8">
                            <Image
                                src={`${IMG_BASE}${imgUrl}`}
                                style={{ maxHeight: '180px', maxWidth: '200px', objectFit: 'contain' }}
                                preview={false}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-gray-300">
                            <PictureOutlined style={{ fontSize: '48px', marginBottom: '8px' }} />
                            <span>暂未配置图片</span>
                        </div>
                    )}
                </div>

                {/* Info Area */}
                <div style={{ padding: '20px' }}>
                    <div className="flex justify-between items-center mb-6">
                        <Title level={4} style={{ margin: 0, fontSize: '18px' }}>{title}</Title>
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            style={{ color: '#1890ff', background: '#e6f7ff', borderRadius: '4px' }}
                            onClick={() => handleOpenConfigModal(title, imgField as string, activeField as string, priceField as string)}
                        >
                            修改
                        </Button>
                    </div>

                    <Text type="secondary" style={{ fontSize: '12px' }}>校服单价 (元)</Text>
                    <div style={{ padding: '12px 16px', background: '#f8f9fa', borderRadius: '8px', marginTop: '4px', marginBottom: '20px' }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', marginRight: '4px' }}>¥</span>
                        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{(priceCents / 100).toFixed(0)}</span>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                            <span style={{ color: '#8c8c8c' }}>状态：</span>
                            <Tag color={isActive ? 'success' : 'default'} style={{ borderRadius: '4px', margin: 0, border: 'none' }}>
                                {isActive ? '已上架' : '未上架'}
                            </Tag>
                        </div>
                    </div>
                </div>
            </Card>
        );
    };

    return (
        <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
            {/* Header Card */}
            <Card style={{ marginBottom: '24px', borderRadius: '12px' }} bodyStyle={{ padding: '16px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '40px', height: '40px', background: '#e6f7ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
                            <ShopOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                        </div>
                        <Title level={3} style={{ margin: 0 }}>商品配置中心</Title>
                    </div>
                    <div>
                        <span style={{ marginRight: '12px', color: '#8c8c8c' }}>当前配置学校：</span>
                        <Select
                            placeholder="请选择学校"
                            style={{ width: 200 }}
                            value={selectedSchoolId}
                            onChange={(val) => setSelectedSchoolId(val)}
                            disabled={loading}
                        >
                            {schools.map((s: SchoolStats) => (
                                <Option key={s.id} value={s.id}>{s.name}</Option>
                            ))}
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Product Configuration Grid */}
            <Row gutter={[24, 24]}>
                <Col xs={24} md={8}>
                    {renderProductCard('夏装 (短袖套装)', 'summerImage', 'isSummerActive', 'summerPrice')}
                </Col>
                <Col xs={24} md={8}>
                    {renderProductCard('秋装 (长袖运动装)', 'autumnImage', 'isAutumnActive', 'autumnPrice')}
                </Col>
                <Col xs={24} md={8}>
                    {renderProductCard('冬装 (防寒冲锋衣)', 'winterImage', 'isWinterActive', 'winterPrice')}
                </Col>
            </Row>

            {/* Size Guide Section */}
            <Divider style={{ marginTop: '48px' }}>辅助配置</Divider>
            <Card title="尺码参考对照图" style={{ borderRadius: '12px' }}>
                <div className="flex flex-col items-center">
                    {config?.sizeGuideImage ? (
                        <div className="relative group p-4 border rounded">
                            <Image
                                src={`${IMG_BASE}${config.sizeGuideImage}`}
                                width={600}
                                style={{ objectFit: 'contain' }}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                <Upload
                                    customRequest={async ({ file }) => handleUploadSizeGuide(file as File)}
                                    showUploadList={false}
                                >
                                    <Button icon={<UploadOutlined />} type="primary">更换参考图</Button>
                                </Upload>
                            </div>
                        </div>
                    ) : (
                        <Upload
                            customRequest={async ({ file }) => handleUploadSizeGuide(file as File)}
                            showUploadList={false}
                        >
                            <Button size="large" icon={<UploadOutlined />} style={{ padding: '30px 60px', height: 'auto' }}>
                                点击上传尺码参考图
                            </Button>
                        </Upload>
                    )}
                    <Text type="secondary" style={{ marginTop: '12px' }}>尺码图将展示在 Web 端订购详情页，帮助家长准确选择尺码</Text>
                </div>
            </Card>

            {/* Config Edit Modal */}
            <Modal
                title={`修改配置 - ${editingCategory?.title}`}
                open={isConfigModalOpen}
                onCancel={() => setIsConfigModalOpen(false)}
                onOk={handleSaveConfig}
                width={450}
                destroyOnClose
            >
                <Form form={configForm} layout="vertical" className="mt-4">
                    <Form.Item
                        name="price"
                        label="商品单价 (元)"
                        rules={[{ required: true, message: '请填写单价' }]}
                    >
                        <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            precision={2}
                            placeholder="如：120.00"
                            size="large"
                            prefix="¥"
                        />
                    </Form.Item>

                    <Form.Item name="imageMode" label="图片配置">
                        <Radio.Group>
                            {config?.[editingCategory?.imgField as keyof SchoolConfig] ? (
                                <Radio value="original">使用原图片</Radio>
                            ) : null}
                            <Radio value="new">上传新图片</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) => prev.imageMode !== curr.imageMode}
                    >
                        {({ getFieldValue }) => {
                            const mode = getFieldValue('imageMode');
                            const currentImg = config?.[editingCategory?.imgField as keyof SchoolConfig] as string;

                            if (mode === 'original' && currentImg) {
                                return (
                                    <div className="mb-6 p-4 bg-gray-50 rounded border flex justify-center">
                                        <Image
                                            src={`${IMG_BASE}${currentImg}`}
                                            width={100}
                                            height={100}
                                            style={{ objectFit: 'contain' }}
                                        />
                                    </div>
                                );
                            }

                            if (mode === 'new') {
                                return (
                                    <div className="mb-6 p-4 border-dashed border-2 rounded flex flex-col items-center" style={{ borderColor: '#d9d9d9' }}>
                                        <Form.Item name="newImagePath" hidden>
                                            <Input />
                                        </Form.Item>
                                        <Upload
                                            customRequest={async ({ file }) => handleUploadLocal(file as File)}
                                            showUploadList={false}
                                        >
                                            {getFieldValue('newImagePath') ? (
                                                <div className="flex flex-col items-center">
                                                    <Image
                                                        src={`${IMG_BASE}${getFieldValue('newImagePath')}`}
                                                        width={100}
                                                        height={100}
                                                        style={{ objectFit: 'contain' }}
                                                        preview={false}
                                                    />
                                                    <Button size="small" className="mt-2">更换新图</Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center py-4 text-gray-400">
                                                    <UploadOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                                                    <span>点击上传新图片</span>
                                                </div>
                                            )}
                                        </Upload>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    </Form.Item>

                    <Form.Item
                        name="active"
                        label="状态"
                        valuePropName="checked"
                    >
                        <Switch
                            checkedChildren="已上架"
                            unCheckedChildren="未上架"
                        />
                    </Form.Item>

                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        修改后的配置将立即对该校前端页面生效。
                    </Text>
                </Form>
            </Modal>
        </div>
    );
};

export default ProductConfig;
