import React, { useEffect, useState } from 'react'
import { Card, Form, Select, Button, Table, Tag, Space, Typography, Input, Modal, InputNumber, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined, ReloadOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { getSchoolList, getOrderList, updateOrder, createSupplementaryOrder } from '../services/api'
import type { School, OrderUIItem } from '../types'

const { Option } = Select
const { Title } = Typography



// Add studentName and idCard to search params in API call if needed, or stick to form values spreading


const OrderList: React.FC = () => {
    const [form] = Form.useForm()
    const [editForm] = Form.useForm()
    const [schools, setSchools] = useState<School[]>([])
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
    const [loading, setLoading] = useState(false)
    const [orderList, setOrderList] = useState<OrderUIItem[]>([])
    const [total, setTotal] = useState(0)
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10 })

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalLoading, setModalLoading] = useState(false)

    // Supplementary Modal State
    const [isSuppModalOpen, setIsSuppModalOpen] = useState(false)
    const [suppForm] = Form.useForm()
    const [suppLoading, setSuppLoading] = useState(false)

    useEffect(() => {
        fetchSchools()
    }, [])

    const fetchSchools = async () => {
        try {
            const res = await getSchoolList()
            if (res.data.code === 200) {
                setSchools(res.data.data)
            }
        } catch (error) {
            console.error("Fetch schools failed", error)
        }
    }

    const fetchOrders = async (values?: any) => {
        setLoading(true)
        try {
            const currentValues = values || form.getFieldsValue()
            const params = {
                page: pagination.page,
                pageSize: pagination.pageSize,
                ...currentValues
            }

            // Clean up 'all' values
            Object.keys(params).forEach(key => {
                if (params[key] === 'all') params[key] = undefined
            })

            const res = await getOrderList(params)
            if (res.data && res.data.code === 200) {
                const { list, total: totalCount } = res.data.data
                const uiItems: OrderUIItem[] = list.map((order: any) => ({
                    ...order,
                    className: order.student?.class?.name || 'Unknown',
                    studentName: order.student?.name || 'Unknown',
                    // summerQty/springQty/winterQty are already pre-calculated by backend now
                }))
                setOrderList(uiItems)
                setTotal(totalCount)
            }
        } catch (error) {
            console.error("Fetch orders failed", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSchoolChange = (value: number | string) => {
        if (value === 'all') {
            setSelectedSchool(null)
        } else {
            const school = schools.find(s => s.id === value)
            setSelectedSchool(school || null)
        }
        form.setFieldsValue({ classId: 'all' })
    }

    const handleSearch = (values: any) => {
        if (pagination.page !== 1) {
            setPagination({ ...pagination, page: 1 })
            // fetchOrders will be called by the other useEffect when page changes to 1
        } else {
            fetchOrders(values)
        }
    }

    const handleReset = () => {
        form.resetFields()
        setSelectedSchool(null)
        setOrderList([])
        setTotal(0)
        setPagination({ ...pagination, page: 1 })
    }

    // --- Correction Logic (Totals) ---
    const handleEdit = (record: OrderUIItem) => {
        editForm.setFieldsValue({
            name: record.studentName,
            idCard: record.student?.idCard,
            summerQty: record.summerQty,
            springQty: record.springQty,
            winterQty: record.winterQty,
            id: record.id
        })
        setIsModalOpen(true)
    }

    const handleModalOk = async () => {
        try {
            const values = await editForm.validateFields()
            setModalLoading(true)

            const res = await updateOrder(values)
            if (res.data.code === 200) {
                message.success('修改成功')
                setIsModalOpen(false)
                fetchOrders() // Refresh list
            }
        } catch (error) {
            console.error("Update failed", error)
        } finally {
            setModalLoading(false)
        }
    }

    const handleModalCancel = () => {
        setIsModalOpen(false)
        editForm.resetFields()
    }

    // --- Supplementary Logic (Increments) ---
    const handleSupplementary = (record?: OrderUIItem) => {
        suppForm.resetFields()
        if (record) {
            suppForm.setFieldsValue({
                studentName: record.studentName,
                idCard: record.student?.idCard
            })
        }
        setIsSuppModalOpen(true)
    }

    const handleSuppModalOk = async () => {
        try {
            const values = await suppForm.validateFields()
            setSuppLoading(true)

            const res = await createSupplementaryOrder({
                idCard: values.idCard,
                summerQty: values.summerQty || 0,
                springQty: values.springQty || 0,
                winterQty: values.winterQty || 0
            })

            if (res.data.code === 200) {
                message.success('增订订单创建成功')
                setIsSuppModalOpen(false)
                fetchOrders()
            }
        } catch (error: any) {
            console.error("Supplementary order failed", error)
        } finally {
            setSuppLoading(false)
        }
    }

    // Add this to handle pagination changes after search
    useEffect(() => {
        // If we have data or have interacted, fetch on page change
        if (orderList.length > 0 || total > 0) { // Check total > 0 to handle cases where orderList might be empty but total is not (e.g., filtering to no results)
            fetchOrders()
        }
    }, [pagination.page, pagination.pageSize])

    const columns: ColumnsType<OrderUIItem> = [
        {
            title: '班级',
            dataIndex: 'className',
            key: 'className',
        },
        {
            title: '姓名',
            dataIndex: 'studentName',
            key: 'studentName',
            render: (text) => <span className="font-medium">{text}</span>,
        },
        {
            title: '夏装套数',
            dataIndex: 'summerQty',
            key: 'summerQty',
            align: 'center',
            render: (val) => val || 0
        },
        {
            title: '春秋装套数',
            dataIndex: 'springQty',
            key: 'springQty',
            align: 'center',
            render: (val) => val || 0
        },
        {
            title: '冬装套数',
            dataIndex: 'winterQty',
            key: 'winterQty',
            align: 'center',
            render: (val) => val || 0
        },
        {
            title: '总金额',
            dataIndex: 'totalAmount',
            key: 'totalAmount',
            render: (amount) => `¥ ${(Number(amount) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            align: 'right',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'default'
                let text = status
                switch (status.toUpperCase()) {
                    case 'PENDING':
                        color = 'orange'
                        text = '待支付'
                        break
                    case 'PAID':
                        color = 'green'
                        text = '已支付'
                        break
                    case 'CANCELLED':
                        color = 'red'
                        text = '已取消'
                        break
                }
                return <Tag color={color}>{text}</Tag>
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    {record.status === 'PAID' ? <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => handleSupplementary(record)}>
                        增订
                    </Button> : <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                        修改
                    </Button>}
                </Space>
            ),
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Title level={4} className="!mb-0">订单管理</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleSupplementary()}>
                    补单 (手动新增)
                </Button>
            </div>

            {/* Filter Section */}
            <Card bordered={false} className="shadow-sm rounded-lg">
                <Form form={form} onFinish={handleSearch} initialValues={{ schoolId: 'all', classId: 'all', uniformType: 'all', status: 'all' }}>
                    <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                        {/* Row 1 */}
                        <Form.Item label="学校" name="schoolId" className="mb-0 w-full">
                            <Select
                                placeholder="选择学校"
                                onChange={handleSchoolChange}
                                className="w-full"
                            >
                                <Option key="all" value="all">全部</Option>
                                {schools.map(school => (
                                    <Option key={school.id} value={school.id}>{school.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item label="班级" name="classId" className="mb-0 w-full">
                            <Select
                                placeholder="选择班级"
                                disabled={!selectedSchool}
                                className="w-full"
                            >
                                <Option key="all" value="all">全部</Option>
                                {selectedSchool?.classes?.map(cls => (
                                    <Option key={cls.id} value={cls.id}>{cls.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item label="状态" name="status" className="mb-0 w-full">
                            <Select placeholder="选择状态" className="w-full">
                                <Option key="all" value="all">全部</Option>
                                <Option value="PENDING">待支付</Option>
                                <Option value="PAID">已支付</Option>
                                <Option value="CANCELLED">已取消</Option>
                            </Select>
                        </Form.Item>

                        {/* Row 2 */}
                        <Form.Item label="姓名" name="studentName" className="mb-0 w-full">
                            <Input placeholder="请输入学生姓名" allowClear />
                        </Form.Item>

                        <Form.Item label="身份证" name="idCard" className="mb-0 w-full">
                            <Input placeholder="请输入身份证号" allowClear />
                        </Form.Item>

                        <div className="flex justify-end items-end">
                            <Space>
                                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                                    搜索
                                </Button>
                                <Button onClick={handleReset} icon={<ReloadOutlined />}>
                                    重置
                                </Button>
                            </Space>
                        </div>
                    </div>
                </Form>
            </Card>

            {/* Data Table */}
            <Card bordered={false} className="shadow-sm rounded-lg" bodyStyle={{ padding: 0 }}>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={orderList}
                    loading={loading}
                    pagination={{
                        current: pagination.page,
                        pageSize: pagination.pageSize,
                        total: total,
                        onChange: (page, pageSize) => setPagination({ page, pageSize }),
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                        position: ['bottomCenter'],
                    }}
                />
            </Card>

            <Modal
                title="修改订单 (补录/纠错)"
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={handleModalCancel}
                confirmLoading={modalLoading}
            >
                <Form
                    form={editForm}
                    layout="vertical"
                >
                    <Form.Item
                        name="id"
                        label="订单ID"
                        hidden
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="name"
                        label="学生姓名"
                        rules={[{ required: true, message: '请输入学生姓名' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="idCard"
                        label="身份证号"
                        rules={[{ required: true, message: '请输入身份证号' }]}
                    >
                        <Input />
                    </Form.Item>

                    <div className="grid grid-cols-3 gap-4">
                        <Form.Item
                            name="summerQty"
                            label="夏装套数"
                            initialValue={0}
                        >
                            <InputNumber min={0} className="w-full" precision={0} />
                        </Form.Item>
                        <Form.Item
                            name="springQty"
                            label="春秋装套数"
                            initialValue={0}
                        >
                            <InputNumber min={0} className="w-full" precision={0} />
                        </Form.Item>
                        <Form.Item
                            name="winterQty"
                            label="冬装套数"
                            initialValue={0}
                        >
                            <InputNumber min={0} className="w-full" precision={0} />
                        </Form.Item>
                    </div>
                    <p className="text-gray-400 text-xs mt-2">提示：此处修改为覆盖式修改。若为 PAID 订单，增加数量会生成新的补扣订单。</p>
                </Form>
            </Modal>

            {/* 新增/增订 弹窗 */}
            <Modal
                title="手动增订/补单"
                open={isSuppModalOpen}
                onOk={handleSuppModalOk}
                onCancel={() => setIsSuppModalOpen(false)}
                confirmLoading={suppLoading}
            >
                <div className="bg-blue-50 p-4 rounded mb-4 text-xs text-blue-700">
                    此功能用于为现有学生**额外增加**校服数量。系统将为您自动生成一笔新的待支付订单。
                </div>
                <Form
                    form={suppForm}
                    layout="vertical"
                >
                    <Form.Item
                        name="studentName"
                        label="学生姓名"
                        hidden={!suppForm.getFieldValue('studentName')}
                    >
                        <Input disabled variant="borderless" className="!p-0 font-bold" />
                    </Form.Item>
                    <Form.Item
                        name="idCard"
                        label="学生身份证码"
                        rules={[{ required: true, message: '请输入身份证号' }]}
                    >
                        <Input placeholder="输入身份证号查找学生" />
                    </Form.Item>

                    <div className="grid grid-cols-3 gap-4 border-t pt-4">
                        <Form.Item
                            name="summerQty"
                            label="新增夏装"
                            initialValue={0}
                        >
                            <InputNumber min={0} className="w-full" precision={0} />
                        </Form.Item>
                        <Form.Item
                            name="springQty"
                            label="新增春秋"
                            initialValue={0}
                        >
                            <InputNumber min={0} className="w-full" precision={0} />
                        </Form.Item>
                        <Form.Item
                            name="winterQty"
                            label="新增冬装"
                            initialValue={0}
                        >
                            <InputNumber min={0} className="w-full" precision={0} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </div>
    )
}

export default OrderList
