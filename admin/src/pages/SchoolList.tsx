import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Select, Button, Table, Badge, Space, Typography, Modal, message, InputNumber, Row, Col } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined, ReloadOutlined, PlusOutlined, EditOutlined, FileSearchOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ExcelUploader from '../components/ExcelUploader'
import type { StudentData, SchoolStats } from '../types'
import { getSchoolStats, importSchoolData, exportSchoolData } from '../services/api'
import ExcelJS from 'exceljs'

const { Option } = Select
const { Title } = Typography

// Mock Data



const SchoolList: React.FC = () => {
    const [form] = Form.useForm()
    const [editForm] = Form.useForm()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [schoolList, setSchoolList] = useState<SchoolStats[]>([])

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingSchool, setEditingSchool] = useState<SchoolStats | null>(null)

    // Import Modal State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [importingSchool, setImportingSchool] = useState<SchoolStats | null>(null)
    const [importedData, setImportedData] = useState<StudentData[]>([])

    const [modalLoading, setModalLoading] = useState(false)

    useEffect(() => {
        // 1. 页面加载时，拉取学校列表
        loadSchools();
    }, []);

    const loadSchools = async () => {
        setLoading(true)
        try {
            const res = await getSchoolStats();
            // res.data is ApiResponse, res.data.data is School[]
            if (res.data && res.data.code === 200) {
                setSchoolList(res.data.data)
            }
        } catch (error) {
            console.error("Failed to load schools", error)
            message.error("Failed to load schools")
        } finally {
            setLoading(false)
        }
    };

    const handleSearch = () => {
        // Build search logic if API supports filtering by name/status
        // For now, reloading or client-side filter could work, 
        // but let's stick to basic reload as placeholder or implement client filter
        loadSchools()
    }

    const handleReset = () => {
        form.resetFields()
        loadSchools()
    }

    // --- Edit Logic ---
    const handleEdit = (record: SchoolStats) => {
        setEditingSchool(record)
        // Mock default values for pricing
        editForm.setFieldsValue({
            priceSummer: 100,
            priceSpring: 150,
            priceWinter: 200,
        })
        setIsEditModalOpen(true)
    }

    const handleEditOk = async () => {
        try {
            const values = await editForm.validateFields()
            console.log('更新学校价格:', { schoolId: editingSchool?.id, ...values })
            message.success(`更新了 ${editingSchool?.name} 的价格`)
            setIsEditModalOpen(false)
        } catch (error) {
            console.log('Validation failed:', error)
        }
    }

    // --- Import Logic ---
    const handleImportClick = (record: SchoolStats) => {
        setImportingSchool(record)
        setImportedData([])
        setIsImportModalOpen(true)
    }

    const handleImportOk = async () => {
        if (importedData.length === 0) {
            message.warning('请先上传数据')
            return
        }

        setModalLoading(true)
        try {
            // Construct payload for appending students to existing school
            const payload = {
                schoolName: importingSchool?.name,
                products: [], // Empty products means don't update products
                students: importedData
            }

            const res = await importSchoolData(payload)
            if (res.data.code === 200) {
                message.success(`成功导入 ${importedData.length} 条数据`)
                setIsImportModalOpen(false)
                loadSchools() // Refresh list to update counts
            } else {
                message.error(res.data.message || 'Import failed')
            }
        } catch (error) {
            console.error('Import Error:', error)
            message.error('Import request failed')
        } finally {
            setModalLoading(false)
        }
    }

    const handleExport = async (record: SchoolStats) => {
        setLoading(true)
        try {
            const res = await exportSchoolData(record.id)
            if (res.data && res.data.code === 200) {
                const data = res.data.data

                const workbook = new ExcelJS.Workbook()
                const worksheet = workbook.addWorksheet('Student Data')

                worksheet.columns = [
                    { header: '班级', key: 'className', width: 15 },
                    { header: '姓名', key: 'studentName', width: 15 },
                    { header: '身份证号', key: 'idCard', width: 25 },
                    { header: '夏装订购套数', key: 'summerQty', width: 15 },
                    { header: '春秋装订购套数', key: 'springQty', width: 15 },
                    { header: '冬装订购套数', key: 'winterQty', width: 15 },
                    { header: '订单总金额', key: 'totalAmount', width: 15 },
                    { header: '付款状态', key: 'status', width: 15 }
                ]

                worksheet.addRows(data)

                // Style header
                worksheet.getRow(1).font = { bold: true }
                worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

                const buffer = await workbook.xlsx.writeBuffer()
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                const url = window.URL.createObjectURL(blob)
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = `${record.name}_学生数据_${new Date().toLocaleDateString()}.xlsx`
                anchor.click()
                window.URL.revokeObjectURL(url)

                message.success('导出完成')
            }
        } catch (error) {
            console.error("Export error:", error)
            message.error("导出失败")
        } finally {
            setLoading(false)
        }
    }

    const columns: ColumnsType<SchoolStats> = [

        {
            title: '学校名称',
            dataIndex: 'name',
            key: 'name',
            fixed: 'left',
            width: 150,
            render: (text) => <span className="font-bold">{text}</span>,
        },
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 60,
            align: 'right',
        },
        {
            title: '总人数',
            dataIndex: 'studentCount',
            key: 'studentCount',
            width: 100,
            align: 'right',
        },
        {
            title: '夏装套数',
            dataIndex: 'summerQty',
            key: 'summerQty',
            width: 100,
            align: 'right',
        },
        {
            title: '春秋装套数',
            dataIndex: 'springQty',
            key: 'springQty',
            width: 110,
            align: 'right',
        },
        {
            title: '冬装套数',
            dataIndex: 'winterQty',
            key: 'winterQty',
            width: 100,
            align: 'right',
        },
        {
            title: '总营收',
            dataIndex: 'totalRevenue',
            key: 'totalRevenue',
            width: 120,
            align: 'right',
            render: (val) => `¥${val.toLocaleString()}`,
        },
        {
            title: '已付款',
            dataIndex: 'paidAmount',
            key: 'paidAmount',
            width: 120,
            align: 'right',
            className: 'text-green-600',
            render: (val) => `¥${val.toLocaleString()}`,
        },
        {
            title: '未付款',
            dataIndex: 'unpaidAmount',
            key: 'unpaidAmount',
            width: 120,
            align: 'right',
            className: 'text-red-600',
            render: (val) => `¥${val.toLocaleString()}`,
        },

        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 240,
            render: (_, record) => (
                <Space size="small" wrap>
                    <Button
                        type="text"
                        size="small"
                        icon={<UploadOutlined />}
                        onClick={() => handleImportClick(record)}
                        className="text-blue-500"
                    >
                        导入
                    </Button>
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        className="text-blue-500"
                    >
                        编辑
                    </Button>
                    <Button
                        type="text"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => handleExport(record)}
                        className="text-green-600"
                    >
                        导出
                    </Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Title level={4} className="!mb-0">学校管理</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/import')}
                >
                    新增学校
                </Button>
            </div>

            {/* Filter Section */}
            <Card bordered={false} className="shadow-sm rounded-lg">
                <Form form={form} layout="inline" className="gap-y-4" onFinish={handleSearch}>
                    <Form.Item name="name">
                        <Input placeholder="学校名称" style={{ width: 240 }} />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                                搜索
                            </Button>
                            <Button onClick={handleReset} icon={<ReloadOutlined />}>
                                重置
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>

            {/* Data Table */}
            <Card bordered={false} className="shadow-sm rounded-lg" bodyStyle={{ padding: 0 }}>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={schoolList}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1200 }}
                />
            </Card>

            {/* Edit Modal (Pricing) */}
            <Modal
                title={`编辑价格: ${editingSchool?.name}`}
                open={isEditModalOpen}
                onOk={handleEditOk}
                onCancel={() => setIsEditModalOpen(false)}
                okText="保存"
                cancelText="取消"
                width={600}
            >
                <Form form={editForm} layout="vertical" className="mt-4">
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="priceSummer" label="夏装" rules={[{ required: true }]}>
                                <InputNumber prefix="¥" style={{ width: '100%' }} min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="priceSpring" label="春秋装" rules={[{ required: true }]}>
                                <InputNumber prefix="¥" style={{ width: '100%' }} min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="priceWinter" label="冬装" rules={[{ required: true }]}>
                                <InputNumber prefix="¥" style={{ width: '100%' }} min={0} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* Import Data Modal */}
            <Modal
                title={`导入学生数据: ${importingSchool?.name}`}
                open={isImportModalOpen}
                confirmLoading={modalLoading}
                onOk={handleImportOk}
                onCancel={() => setIsImportModalOpen(false)}
                okText="提交导入"
                cancelText="取消"
                width={800}
            >
                <div className="mt-4">
                    <ExcelUploader
                        onFinish={(data) => setImportedData(data)}
                        preview={true}
                    />
                </div>
            </Modal>
        </div>
    )
}

export default SchoolList
