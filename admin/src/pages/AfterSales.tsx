import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Descriptions, message, Typography, Badge, Tabs, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getAfterSalesList, approveAfterSales, rejectAfterSales } from '../services/api';
import type { AfterSalesRecord } from '../types';

const { Text } = Typography;

const productTypeMap: Record<number, string> = { 0: '夏装', 1: '春秋装', 2: '冬装' };

function getProductName(product?: any) {
    if (!product) return '校服';
    return productTypeMap[product.type] ?? '校服';
}


const AfterSales: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AfterSalesRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
    const [activeTab, setActiveTab] = useState('ALL');
    const [search, setSearch] = useState('');

    // Modal state for detail
    const [selectedRecord, setSelectedRecord] = useState<AfterSalesRecord | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const fetchData = async (page = pagination.page, status = activeTab) => {
        setLoading(true);
        try {
            const params: any = { page, pageSize: pagination.pageSize };
            if (status !== 'ALL') params.status = status;

            const res = await getAfterSalesList(params);
            if (res.data.code === 200) {
                setData(res.data.data.list);
                setTotal(res.data.data.total);
            }
        } catch (error) {
            message.error('获取售后列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleAction = async (id: number, action: 'approve' | 'reject') => {
        setProcessing(true);
        try {
            const res = action === 'approve' ? await approveAfterSales(id) : await rejectAfterSales(id, '');
            if (res.data.code === 200) {
                message.success(action === 'approve' ? '审核通过，退款已发起' : '已驳回申请');
                setIsModalOpen(false);
                fetchData();
            } else {
                message.error(res.data.message || '操作失败');
            }
        } catch (error: any) {
            message.error(error?.response?.data?.message || error?.message || '操作失败');
        } finally {
            setProcessing(false);
        }
    };

    const columns: ColumnsType<AfterSalesRecord> = [
        { title: '售后单号', dataIndex: 'id', key: 'id', width: 100 },
        {
            title: '关联订单',
            key: 'orderNo',
            render: (_, r) => r.order?.orderNo || `#${r.orderId}`
        },
        { title: '学生姓名', key: 'student', render: (_, r) => r.order?.student?.name || '-' },
        {
            title: '售后类型',
            dataIndex: 'type',
            key: 'type',
            render: (type) => (
                <Tag color={type === 'REFUND' ? 'volcano' : 'geekblue'}>
                    {type === 'REFUND' ? '退款' : '换码'}
                </Tag>
            )
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const map: any = {
                    'PENDING': { badgeStatus: 'processing', text: '待审核' },
                    'PROCESSED': { badgeStatus: 'success', text: '已通过' },
                    'REJECTED': { badgeStatus: 'error', text: '已驳回' }
                };
                const cfg = map[status] || { badgeStatus: 'default', text: status };
                return <Badge status={cfg.badgeStatus} text={cfg.text} />;
            }
        },
        {
            title: '商品/尺码',
            key: 'items',
            render: (_, r) => {
                if (r.type === 'EXCHANGE') {
                    const newSizeDisplay = r.isSpecialSize
                        ? <Tag color="purple">特殊:{r.height}cm/{r.weight}斤</Tag>
                        : <Text strong style={{ color: '#1677ff' }}>{r.newSize || '160#'}</Text>;
                    return <Text type="secondary">{r.originalSize} → {newSizeDisplay}</Text>;
                }
                const name = getProductName(r.product);
                return <Text type="secondary">{name} {r.newQuantity} 套</Text>;
            }
        },
        { title: '申请时间', dataIndex: 'createdAt', key: 'createdAt', render: (val) => new Date(val).toLocaleString() },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Button type="link" onClick={() => { setSelectedRecord(record); setIsModalOpen(true); }}>
                    处理详情
                </Button>
            ),
        },
    ];

    return (
        <div className="p-6 bg-white shadow-sm rounded-lg min-h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">售后服务中心</h1>
                    <p className="text-gray-500 mt-1">处理调换尺码与退款申请</p>
                </div>
                <Input
                    placeholder="搜索订单号/姓名..."
                    prefix={<SearchOutlined />}
                    style={{ width: 250 }}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    { key: 'ALL', label: '全部' },
                    { key: 'PENDING', label: '待处理' },
                    { key: 'PROCESSED', label: '已完成' },
                    { key: 'REJECTED', label: '已驳回' },
                ]}
            />

            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: pagination.page,
                    pageSize: pagination.pageSize,
                    total: total,
                    onChange: (p) => { setPagination({ ...pagination, page: p }); fetchData(p); }
                }}
            />

            <Modal
                title="售后申请审批"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={selectedRecord?.status === 'PENDING' ? [
                    <Button key="close" onClick={() => setIsModalOpen(false)}>取消</Button>,
                    <Button key="reject" danger onClick={() => handleAction(selectedRecord.id, 'reject')} loading={processing}>驳回申请</Button>,
                    selectedRecord?.type === 'REFUND' ? (
                        <Button key="approve" type="primary" onClick={() => handleAction(selectedRecord.id, 'approve')} loading={processing}>
                            通过并发起退款
                        </Button>
                    ) : (
                        <Text type="secondary" key="info" style={{ marginLeft: 16 }}>调换申请无需审核，发货时将自动处理</Text>
                    )
                ] : [<Button key="ok" type="primary" onClick={() => setIsModalOpen(false)}>确定</Button>]}
                width={600}
            >
                {selectedRecord && (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="售后单号">{selectedRecord.id}</Descriptions.Item>
                        <Descriptions.Item label="售后类型">
                            <Tag color={selectedRecord.type === 'REFUND' ? 'volcano' : 'geekblue'}>
                                {selectedRecord.type === 'REFUND' ? '退款' : '换码'}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="学生姓名">{selectedRecord.order?.student?.name || '—'}</Descriptions.Item>
                        <Descriptions.Item label="订单号">{selectedRecord.order?.orderNo || `#${selectedRecord.orderId}`}</Descriptions.Item>

                        {selectedRecord.type === 'EXCHANGE' ? (
                            <>
                                <Descriptions.Item label="当前尺码">{selectedRecord.originalSize}</Descriptions.Item>
                                <Descriptions.Item label="目标尺码" contentStyle={{ color: '#1677ff', fontWeight: 'bold' }}>
                                    {selectedRecord.isSpecialSize ? (
                                        <Badge status="warning" text={`特殊尺码 (${selectedRecord.height}cm / ${selectedRecord.weight}斤)`} />
                                    ) : (
                                        selectedRecord.newSize || '160#'
                                    )}
                                </Descriptions.Item>
                                <Descriptions.Item label="调换数量">{selectedRecord.newQuantity} 件</Descriptions.Item>
                            </>
                        ) : (
                            <>
                                <Descriptions.Item label="退款商品">
                                    {getProductName(selectedRecord.product)} {selectedRecord.newQuantity} 套
                                </Descriptions.Item>
                                <Descriptions.Item label="退款金额">
                                    <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                                        ¥{((selectedRecord.product?.price || 0) * selectedRecord.newQuantity) / 100}
                                    </Text>
                                </Descriptions.Item>
                                {selectedRecord.newQuantity < (selectedRecord.originalQuantity || 0) && (
                                    <Descriptions.Item label="售后说明">
                                        部分退款（购买 {selectedRecord.originalQuantity} 套，退款 {selectedRecord.newQuantity} 套）
                                    </Descriptions.Item>
                                )}
                            </>
                        )}

                        <Descriptions.Item label="申请时间">{new Date(selectedRecord.createdAt).toLocaleString()}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
};

export default AfterSales;
