import React, { useState, useEffect } from 'react';
import {
    Tabs, Card, Button, Modal, Form, Input, Table, Space,
    Tag, Select, Upload, Row, Col, Typography, message, Badge, Empty
} from 'antd';
import {
    BankOutlined, TeamOutlined, PlusOutlined, DownloadOutlined,
    UploadOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
    CloseCircleOutlined, EditOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
    getSchoolList, batchCreateSchool, batchUpdateSchool, rosterPreview, rosterApply, getClassList
} from '../services/api';
import type { School, ClassEntity } from '../types';
import * as ExcelJS from 'exceljs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const SchoolMgmt: React.FC = () => {
    const [activeTab, setActiveTab] = useState('1');
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(false);

    // Tab 1: Architecture State
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [selectedClasses, setSelectedClasses] = useState<ClassEntity[]>([]);
    const [classLoading, setClassLoading] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSchool, setEditingSchool] = useState<School | null>(null);
    const [createForm] = Form.useForm();
    const [creating, setCreating] = useState(false);

    // Tab 2: Roster State
    const [targetSchoolId, setTargetSchoolId] = useState<number | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [stats, setStats] = useState({ success: 0, conflict: 0, fail: 0 });
    const [previewLoading, setPreviewLoading] = useState(false);
    const [applying, setApplying] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getSchoolList();
            if (res.data.code === 200) {
                setSchools(res.data.data);
                // If we have a selected school, update its data from the fresh list
                if (selectedSchool) {
                    const fresh = res.data.data.find((s: School) => s.id === selectedSchool.id);
                    if (fresh) {
                        setSelectedSchool(fresh);
                        fetchClasses(fresh.id);
                    }
                }
            }
        } catch (error) {
            message.error('获取学校数据失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchClasses = async (schoolId: number) => {
        setClassLoading(true);
        try {
            const res = await getClassList(schoolId);
            if (res.data.code === 200) {
                setSelectedClasses(res.data.data);
            }
        } catch (error) {
            message.error('获取班级列表失败');
        } finally {
            setClassLoading(false);
        }
    };

    const handleSelectSchool = (school: School) => {
        setSelectedSchool(school);
        fetchClasses(school.id);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- Tab 1: Architecture Logic ---
    const handleOpenCreateModal = () => {
        setEditingSchool(null);
        createForm.setFieldsValue({ name: '', classes: [{ name: '' }] });
        setIsCreateModalOpen(true);
    };

    const handleEditSchool = (school: School) => {
        setEditingSchool(school);
        const initialClasses = school.classes?.length
            ? school.classes.map(c => ({ name: c.name }))
            : [{ name: '' }];
        createForm.setFieldsValue({
            name: school.name,
            classes: initialClasses
        });
        setIsCreateModalOpen(true);
    };

    const handleSubmitSchool = async () => {
        try {
            const values = await createForm.validateFields();

            // Validation: Check for duplicate name (excluding current school if editing)
            const exists = schools.some(s => s.name === values.name && s.id !== editingSchool?.id);
            if (exists) {
                message.error('该学校名称已存在，请换一个名称');
                return;
            }

            setCreating(true);
            const classList = values.classes ? values.classes.map((c: any) => c.name).filter(Boolean) : [];

            let res;
            if (editingSchool) {
                res = await batchUpdateSchool(editingSchool.id, { name: values.name, classes: classList });
            } else {
                res = await batchCreateSchool({ name: values.name, classes: classList });
            }

            if (res.data.code === 200) {
                message.success(editingSchool ? '重命名及班级同步成功' : '创建成功');
                setIsCreateModalOpen(false);
                createForm.resetFields();
                fetchData();
            } else if (res.data.code === 500 && res.data.message?.includes('不允许删除')) {
                message.error(res.data.message);
            }
        } catch (error: any) {
            console.error(error);
            if (error.response?.data?.message) {
                message.error(error.response.data.message);
            }
        } finally {
            setCreating(false);
        }
    };

    const schoolColumns: ColumnsType<School> = [
        { title: '学校名称', dataIndex: 'name', key: 'name', render: (text) => <Text strong>{text}</Text> },
        {
            title: '班级数量',
            key: 'classCount',
            render: (_, r) => <Badge count={r.classes?.length || 0} showZero color="#108ee9" />
        },
        {
            title: '购买人数',
            dataIndex: 'studentCount',
            key: 'studentCount',
            render: (val) => <Tag color="blue">{val || 0} 人</Tag>
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Button
                        size="small"
                        type="link"
                        icon={<EditOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleEditSchool(record); }}
                    >
                        编辑
                    </Button>
                </Space>
            ),
        },
    ];

    const classColumns: ColumnsType<ClassEntity> = [
        { title: '班级名称', dataIndex: 'name', key: 'name' },
        {
            title: '班级人数',
            dataIndex: 'studentCount',
            key: 'studentCount',
            render: (val) => <Tag color="green">{val || 0} 人</Tag>
        },
    ];

    // --- Tab 2: Roster Matching Logic ---
    const handleDownloadTemplate = () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('名单模板');
        sheet.columns = [
            { header: '学生姓名', key: 'name', width: 20 },
            { header: '分配班级', key: 'class', width: 20 }
        ];
        sheet.addRow({ name: '张三', class: '高一(1)班' });
        sheet.addRow({ name: '李四', class: '高一(2)班' });

        workbook.xlsx.writeBuffer().then(buffer => {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '校服订购名单匹配模板.xlsx';
            a.click();
        });
    };

    const handleUploadRoster = async (file: File) => {
        if (!targetSchoolId) {
            message.warning('请先选择目标学校');
            return false;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const buffer = e.target?.result;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer as ArrayBuffer);
            const sheet = workbook.worksheets[0];
            const roster: any[] = [];

            sheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) { // Skip header
                    const studentName = row.getCell(1).text;
                    const className = row.getCell(2).text;
                    if (studentName && className) {
                        roster.push({ studentName, className });
                    }
                }
            });

            if (roster.length === 0) {
                message.error('Excel中未找到有效数据');
                return;
            }

            setPreviewLoading(true);
            try {
                const res = await rosterPreview({ schoolId: targetSchoolId, roster });
                if (res.data.code === 200) {
                    setPreviewData(res.data.data.results);
                    setStats(res.data.data.stats);
                    message.success('预览加载成功');
                }
            } catch (error) {
                message.error('解析匹配失败');
            } finally {
                setPreviewLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    };

    const handleApplyMatches = async () => {
        const matches = previewData
            .filter(r => (r.status === 'A' && r.matchInfo) || (r.status === 'B' && r.selectedStudentId))
            .map(r => ({
                studentId: r.status === 'A' ? r.matchInfo.studentId : r.selectedStudentId,
                classId: r.targetClassId
            }));

        if (matches.length === 0) {
            message.warning('没有可导入的匹配项');
            return;
        }

        setApplying(true);
        try {
            const res = await rosterApply({ matches });
            if (res.data.code === 200) {
                message.success(res.data.message);
                setPreviewData([]);
                setStats({ success: 0, conflict: 0, fail: 0 });
            }
        } catch (error) {
            message.error('导入失败');
        } finally {
            setApplying(false);
        }
    };

    const rosterColumns: ColumnsType<any> = [
        {
            title: '花名册姓名',
            dataIndex: 'originalName',
            key: 'name',
            render: (val) => <Text strong>{val}</Text>
        },
        { title: '分配班级', dataIndex: 'originalClass', key: 'class' },
        {
            title: '系统匹配订单姓名',
            key: 'matchName',
            render: (_, r) => {
                if (r.status === 'A') return r.matchInfo.studentName;
                if (r.status === 'B') return <span className="text-orange-500 font-bold">⚠️ 发现 {r.conflicts.length} 个同名</span>;
                return '-';
            }
        },
        {
            title: '信息验证 (身份证后6位/手机号)',
            key: 'verify',
            width: 300,
            render: (_, r) => {
                if (r.status === 'A') return <Tag>{r.matchInfo.idCardLast6}</Tag>;
                if (r.status === 'B') {
                    return (
                        <Select
                            placeholder="请下拉手动关联订单"
                            className="w-full"
                            onChange={(val) => {
                                const newData = [...previewData];
                                const index = newData.findIndex(item => item === r);
                                newData[index].selectedStudentId = val;
                                setPreviewData(newData);
                            }}
                        >
                            {r.conflicts.map((c: any) => (
                                <Select.Option key={c.studentId} value={c.studentId}>
                                    {c.studentName} - {c.idCardLast6} ({c.phone || '无手机'})
                                </Select.Option>
                            ))}
                        </Select>
                    );
                }
                return '-';
            }
        },
        {
            title: '匹配状态',
            dataIndex: 'status',
            key: 'status',
            render: (status, r) => {
                if (status === 'A') return <Tag color="success" icon={<CheckCircleOutlined />}>匹配成功</Tag>;
                if (status === 'B') return <Tag color={r.selectedStudentId ? 'processing' : 'warning'} icon={<ExclamationCircleOutlined />}>{r.selectedStudentId ? '已选定' : '待选择'}</Tag>;
                return <Tag color="error" icon={<CloseCircleOutlined />}>无付款记录</Tag>;
            }
        }
    ];

    return (
        <div className="p-6">
            <Card bordered={false} className="shadow-sm rounded-lg">
                <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
                    <TabPane
                        tab={<span><BankOutlined />学校与班级架构</span>}
                        key="1"
                    >
                        <div className="py-4">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <Title level={4}>组织架构管理</Title>
                                    <Text type="secondary">维护学校及所属班级的基础层级关系</Text>
                                </div>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={handleOpenCreateModal}
                                >
                                    新建学校
                                </Button>
                            </div>

                            <Row gutter={24}>
                                <Col span={14}>
                                    <Card
                                        title={<Space><BankOutlined />学校列表</Space>}
                                        size="small"
                                        className="h-full"
                                    >
                                        <Table
                                            columns={schoolColumns}
                                            dataSource={schools}
                                            rowKey="id"
                                            loading={loading}
                                            pagination={{ pageSize: 8 }}
                                            onRow={(record) => ({
                                                onClick: () => handleSelectSchool(record),
                                                className: `cursor-pointer transition-colors ${selectedSchool?.id === record.id ? 'bg-blue-50' : ''}`
                                            })}
                                        />
                                    </Card>
                                </Col>
                                <Col span={10}>
                                    <Card
                                        title={<Space><TeamOutlined />{selectedSchool ? `${selectedSchool.name} - 班级列表` : '班级列表'}</Space>}
                                        size="small"
                                        className="h-full"
                                    >
                                        {selectedSchool ? (
                                            <Table
                                                columns={classColumns}
                                                dataSource={selectedClasses}
                                                rowKey="id"
                                                loading={classLoading}
                                                pagination={{ pageSize: 8 }}
                                            />
                                        ) : (
                                            <Empty className="py-20" description="请选择左侧学校查看班级" />
                                        )}
                                    </Card>
                                </Col>
                            </Row>
                        </div>
                    </TabPane>

                    <TabPane
                        tab={<span><TeamOutlined />花名册导入与分班匹配</span>}
                        key="2"
                    >
                        <div className="py-4">
                            <div className="p-6 bg-blue-50 border border-blue-100 rounded-lg mb-6">
                                <Row gutter={24} align="middle">
                                    <Col span={8}>
                                        <div className="mb-2 font-bold">目标学校</div>
                                        <Select
                                            placeholder="选择目标学校..."
                                            className="w-full"
                                            value={targetSchoolId}
                                            onChange={setTargetSchoolId}
                                        >
                                            {schools.map(s => (
                                                <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
                                            ))}
                                        </Select>
                                    </Col>
                                    <Col span={8}>
                                        <div className="mb-2 font-bold">操作</div>
                                        <Space>
                                            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                                                下载标准模板
                                            </Button>
                                            <Upload
                                                beforeUpload={handleUploadRoster}
                                                showUploadList={false}
                                                accept=".xlsx,.xls"
                                            >
                                                <Button type="primary" icon={<UploadOutlined />}>
                                                    上传花名册
                                                </Button>
                                            </Upload>
                                        </Space>
                                    </Col>
                                </Row>
                            </div>

                            {previewData.length > 0 && (
                                <Row gutter={16} className="mb-6">
                                    <Col span={8}>
                                        <Card size="small" className="border-green-100 bg-green-50">
                                            <div className="flex items-center">
                                                <CheckCircleOutlined className="text-2xl text-green-500 mr-3" />
                                                <div>
                                                    <div className="text-gray-500">匹配成功 (可入库)</div>
                                                    <div className="text-2xl font-bold text-green-600">{stats.success}</div>
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card size="small" className="border-orange-100 bg-orange-50">
                                            <div className="flex items-center">
                                                <ExclamationCircleOutlined className="text-2xl text-orange-500 mr-3" />
                                                <div>
                                                    <div className="text-gray-500">重名冲突 (需人工)</div>
                                                    <div className="text-2xl font-bold text-orange-600">{stats.conflict}</div>
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                    <Col span={8}>
                                        <Card size="small" className="border-red-100 bg-red-50">
                                            <div className="flex items-center">
                                                <CloseCircleOutlined className="text-2xl text-red-500 mr-3" />
                                                <div>
                                                    <div className="text-gray-500">无订单记录 (未买校服)</div>
                                                    <div className="text-2xl font-bold text-red-600">{stats.fail}</div>
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                </Row>
                            )}

                            <Table
                                title={() => (
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg">智能匹配工作台预览</span>
                                        <Button
                                            type="primary"
                                            disabled={previewData.length === 0}
                                            loading={applying}
                                            onClick={handleApplyMatches}
                                        >
                                            确认更新班级入库
                                        </Button>
                                    </div>
                                )}
                                dataSource={previewData}
                                columns={rosterColumns}
                                rowKey={(r, i) => `${r.originalName}-${i}`}
                                loading={previewLoading}
                            />
                        </div>
                    </TabPane>
                </Tabs>
            </Card>

            <Modal
                title={editingSchool ? "编辑学校架构" : "新建学校结构"}
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                onOk={handleSubmitSchool}
                confirmLoading={creating}
                width={600}
                destroyOnClose
            >
                <Form form={createForm} layout="vertical" initialValues={{ classes: [{ name: '' }] }}>
                    <Form.Item
                        name="name"
                        label="学校名称"
                        rules={[{ required: true, message: '请输入学校名称' }]}
                    >
                        <Input placeholder="如：阳光实验小学" />
                    </Form.Item>

                    <Form.Item label="班级设置">
                        <Form.List name="classes">
                            {(fields, { add, remove }) => (
                                <>
                                    <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '12px', paddingRight: '8px' }}>
                                        {fields.map(({ key, name, ...restField }) => (
                                            <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                <Form.Item
                                                    {...restField}
                                                    name={[name, 'name']}
                                                    rules={[{ required: true, message: '请输入班级名称' }]}
                                                >
                                                    <Input placeholder="如：高一(1)班" style={{ width: 400 }} />
                                                </Form.Item>
                                                <Button type="link" danger onClick={() => remove(name)}>删除</Button>
                                            </Space>
                                        ))}
                                    </div>
                                    <Form.Item>
                                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                            增加班级
                                        </Button>
                                    </Form.Item>
                                </>
                            )}
                        </Form.List>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default SchoolMgmt;
