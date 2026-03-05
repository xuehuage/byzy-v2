import React, { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, DatePicker, Button, Space, message } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
import type { ColumnsType } from 'antd/es/table';
import { getSchoolStats } from '../services/api';
import type { SchoolStats } from '../types';

interface SchoolSaleRecord {
    key: string;
    schoolName: string;
    summerQty: number;
    autumnQty: number;
    winterQty: number;
    refundedQty: number;
    totalAmount: number;
}

const Dashboard: React.FC = () => {
    const [data, setData] = useState<SchoolSaleRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [dates, setDates] = useState<[Dayjs | null, Dayjs | null] | null>([
        dayjs().subtract(6, 'month'),
        dayjs()
    ]);

    const fetchData = async (startDate?: string, endDate?: string) => {
        setLoading(true);
        try {
            const res = await getSchoolStats({ startDate, endDate });
            if (res.data.code === 200 && res.data.data) {
                const stats: SchoolStats[] = res.data.data;
                const mappedData: SchoolSaleRecord[] = stats.map((item) => ({
                    key: item.id.toString(),
                    schoolName: item.name,
                    summerQty: item.summerQty || 0,
                    autumnQty: item.autumnQty || 0,
                    winterQty: item.winterQty || 0,
                    refundedQty: item.totalRefundedQty || 0,
                    totalAmount: item.paidAmount || 0,
                }));
                setData(mappedData);
            }
        } catch (error) {
            console.error('Failed to fetch school stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (dates && dates[0] && dates[1]) {
            fetchData(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
        } else {
            fetchData();
        }
    }, []);

    const handleSearch = () => {
        if (!dates || !dates[0] || !dates[1]) {
            message.warning('请选择查询日期范围');
            return;
        }

        // Validate max 1 year span
        const diffInDays = dates[1].diff(dates[0], 'day');
        if (diffInDays > 366) { // 366 for leap years
            message.error('最大时间跨度支持一年');
            return;
        }

        fetchData(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
    };

    // Calculate totals for cards
    const totalSummer = data.reduce((sum, item) => sum + item.summerQty, 0);
    const totalAutumn = data.reduce((sum, item) => sum + item.autumnQty, 0);
    const totalWinter = data.reduce((sum, item) => sum + item.winterQty, 0);
    const totalSales = data.reduce((sum, item) => sum + item.totalAmount, 0);

    const columns: ColumnsType<SchoolSaleRecord> = [
        { title: '学校名称', dataIndex: 'schoolName', key: 'schoolName', width: '20%' },
        {
            title: '夏装 (套)',
            dataIndex: 'summerQty',
            key: 'summerQty',
            align: 'center',
            render: (val: number) => <span style={{ color: '#1677ff' }}>{val.toLocaleString()}</span>
        },
        {
            title: '秋装 (套)',
            dataIndex: 'autumnQty',
            key: 'autumnQty',
            align: 'center',
            render: (val: number) => <span style={{ color: '#fa8c16' }}>{val.toLocaleString()}</span>
        },
        {
            title: '冬装 (套)',
            dataIndex: 'winterQty',
            key: 'winterQty',
            align: 'center',
            render: (val: number) => <span style={{ color: '#13c2c2' }}>{val.toLocaleString()}</span>
        },
        {
            title: '已退款 (套)',
            dataIndex: 'refundedQty',
            key: 'refundedQty',
            align: 'center',
            render: (val: number) => <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{val > 0 ? val.toLocaleString() : '-'}</span>
        },
        {
            title: '总销售额 (元)',
            dataIndex: 'totalAmount',
            key: 'totalAmount',
            align: 'right',
            render: (val: number) => <strong style={{ fontSize: '15px' }}>¥ {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        },
    ];

    return (
        <div >
            {/* Filter Section */}
            <Card className="mb-6 shadow-sm rounded-lg" bodyStyle={{ padding: '16px 24px' }}>
                <Space size="large" align="center">
                    <Text strong style={{ fontSize: '15px' }}>查询时间</Text>
                    <RangePicker
                        value={dates}
                        onChange={(val) => setDates(val)}
                        allowClear={false}
                        style={{ width: 280 }}
                    />
                    <Button
                        type="primary"
                        icon={null} // Using a text button for '确定'
                        loading={loading}
                        onClick={handleSearch}
                        style={{ borderRadius: '6px', padding: '0 24px' }}
                    >
                        确定
                    </Button>
                </Space>
            </Card>

            {/* Top Cards Section */}
            <Row gutter={16} className="mb-6  ">
                <Col span={6}>
                    <Card className="shadow-sm rounded-lg " >
                        <Statistic
                            title={<span style={{ fontWeight: 'bold', color: '#000' }}>夏装销售总量</span>}
                            value={totalSummer}
                            suffix="套"
                            valueStyle={{ color: '#1677ff', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false} className="shadow-sm rounded-lg" >
                        <Statistic
                            title={<span style={{ fontWeight: 'bold', color: '#000' }}>秋装销售总量</span>}
                            value={totalAutumn}
                            suffix="套"
                            valueStyle={{ color: '#fa8c16', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card className="shadow-sm rounded-lg" >
                        <Statistic
                            title={<span style={{ fontWeight: 'bold', color: '#000' }}>冬装销售总量</span>}
                            value={totalWinter}
                            suffix="套"
                            valueStyle={{ color: '#13c2c2', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card className="shadow-sm rounded-lg" >
                        <Statistic
                            title={<span style={{ fontWeight: 'bold', color: '#000' }}>总销售额</span>}
                            value={totalSales}
                            precision={2}
                            prefix="¥"
                            valueStyle={{ color: '#333', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Main Data Table Section */}
            <Title level={5} className="mb-4">各校销售概览</Title>
            <Card className="shadow-sm rounded-lg" >
                <Table
                    columns={columns}
                    dataSource={data}
                    pagination={false}
                    bordered={false}
                    size="middle"
                    loading={loading}
                />
            </Card>
        </div>
    );
};

export default Dashboard;
