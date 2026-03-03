import React, { useState, useEffect, useCallback } from 'react';
import {
    Table, Button, Input, Space, Modal, message, Tag, Typography, Card, Statistic
} from 'antd';
import {
    SearchOutlined, ExportOutlined, CheckCircleOutlined, ExclamationCircleOutlined, TruckOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import request from '../utils/request';

const { Text } = Typography;
const { confirm } = Modal;

interface ShippingRow {
    schoolId: number;
    schoolName: string;
    pendingOrderCount: number;
    qtySummary: string;
}

// Convert JSON array to CSV and trigger download
function downloadCSV(rows: any[], filename: string) {
    if (!rows.length) { message.warning('暂无数据可导出'); return; }
    const headers = Object.keys(rows[0]);
    const headerLabels: Record<string, string> = {
        orderNo: '订单号', studentName: '学生姓名', className: '班级',
        birthday: '生日', productType: '商品类型',
        size: '尺码', isSpecialSize: '特殊身材', height: '身高(cm)',
        weight: '体重(斤)', quantity: '套数', totalAmount: '支付金额(元)',
        status: '订单状态'
    };
    const csvHeader = headers.map(h => headerLabels[h] || h).join(',');
    const csvRows = rows.map(r =>
        headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const bom = '\uFEFF'; // UTF-8 BOM for Excel
    const csv = bom + [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const ShippingMgmt: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ShippingRow[]>([]);
    const [searchName, setSearchName] = useState('');
    const [exportLoading, setExportLoading] = useState<number | null>(null);
    const [confirmLoading, setConfirmLoading] = useState<number | null>(null);

    const fetchData = useCallback(async (name?: string) => {
        setLoading(true);
        try {
            const res = await request.get('/shipping/stats', { params: name ? { schoolName: name } : {} });
            if (res.data.code === 200) {
                setData(res.data.data);
            }
        } catch {
            message.error('获取发货统计失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExport = async (record: ShippingRow) => {
        setExportLoading(record.schoolId);
        try {
            const res = await request.get(`/shipping/${record.schoolId}/export`);
            if (res.data.code === 200) {
                downloadCSV(res.data.data, `发货单_${record.schoolName}_${new Date().toLocaleDateString('zh-CN')}.csv`);
                message.success('发货单已导出');
            }
        } catch {
            message.error('导出失败');
        } finally {
            setExportLoading(null);
        }
    };

    const handleConfirmShip = (record: ShippingRow) => {
        confirm({
            title: '确认发货',
            icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
            content: (
                <div>
                    <p>即将确认 <strong>{record.schoolName}</strong> 的发货</p>
                    <p>共 <strong style={{ color: '#1677ff' }}>{record.pendingOrderCount}</strong> 份订单，{record.qtySummary}</p>
                    <p style={{ color: '#ff4d4f', marginTop: 8 }}>确认后，以上所有已付款订单将更改为「已发货」状态，不可撤销！</p>
                </div>
            ),
            okText: '确认发货',
            okType: 'primary',
            cancelText: '取消',
            onOk: async () => {
                setConfirmLoading(record.schoolId);
                try {
                    const res = await request.post(`/shipping/${record.schoolId}/confirm`);
                    if (res.data.code === 200) {
                        message.success(`已发货 ${res.data.data.updatedCount} 份订单`);
                        fetchData(searchName || undefined);
                    } else {
                        message.error(res.data.message || '操作失败');
                    }
                } catch {
                    message.error('操作失败，请重试');
                } finally {
                    setConfirmLoading(null);
                }
            }
        });
    };

    const columns: ColumnsType<ShippingRow> = [
        {
            title: '学校名称',
            dataIndex: 'schoolName',
            key: 'schoolName',
            render: (name) => <Text strong>{name}</Text>
        },
        {
            title: '未发货订单数',
            dataIndex: 'pendingOrderCount',
            key: 'pendingOrderCount',
            render: (count) => (
                <Tag color="blue" style={{ fontSize: 14, padding: '2px 10px', fontWeight: 700 }}>
                    {count} 份
                </Tag>
            )
        },
        {
            title: '未发货套数',
            dataIndex: 'qtySummary',
            key: 'qtySummary',
            render: (text) => <Text>{text}</Text>
        },
        {
            title: '操作',
            key: 'action',
            width: 240,
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<ExportOutlined />}
                        onClick={() => handleExport(record)}
                        loading={exportLoading === record.schoolId}
                        size="small"
                    >
                        导出发货单
                    </Button>
                    <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleConfirmShip(record)}
                        loading={confirmLoading === record.schoolId}
                        size="small"
                    >
                        确认发货
                    </Button>
                </Space>
            )
        }
    ];

    const totalOrders = data.reduce((s, r) => s + r.pendingOrderCount, 0);

    return (
        <div className="p-6 bg-white shadow-sm rounded-lg min-h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <TruckOutlined style={{ color: '#1677ff' }} /> 发货管理
                    </h1>
                    <p className="text-gray-500 mt-1">按学校汇总待发货订单，支持批量确认发货与导出发货单</p>
                </div>
                <Card size="small" style={{ minWidth: 140 }}>
                    <Statistic
                        title="待发货学校"
                        value={data.length}
                        suffix="所"
                        valueStyle={{ color: '#1677ff', fontWeight: 700 }}
                    />
                </Card>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3 mb-5">
                <Input
                    placeholder="搜索学校名称..."
                    prefix={<SearchOutlined />}
                    style={{ width: 280 }}
                    value={searchName}
                    onChange={e => setSearchName(e.target.value)}
                    onPressEnter={() => fetchData(searchName)}
                    allowClear
                />
                <Button type="primary" icon={<SearchOutlined />} onClick={() => fetchData(searchName)}>
                    搜索
                </Button>
                <Button onClick={() => { setSearchName(''); fetchData(); }}>
                    重置
                </Button>
            </div>

            {/* Summary Banner */}
            {totalOrders > 0 && (
                <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700 text-sm font-medium">
                    共 <strong>{data.length}</strong> 所学校，待发货订单合计 <strong>{totalOrders}</strong> 份
                </div>
            )}

            <Table
                columns={columns}
                dataSource={data}
                rowKey="schoolId"
                loading={loading}
                pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 所学校` }}
                locale={{ emptyText: '暂无待发货订单' }}
                bordered
            />
        </div>
    );
};

export default ShippingMgmt;
