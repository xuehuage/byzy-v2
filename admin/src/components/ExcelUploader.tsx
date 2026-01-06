import React, { useState } from 'react'
import { Upload, Table, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps, UploadFile } from 'antd'
import ExcelJS from 'exceljs'

import type { StudentData } from '../types'

const { Dragger } = Upload

interface ExcelUploaderProps {
    onFinish: (data: StudentData[]) => void
    preview?: boolean
}

const ExcelUploader: React.FC<ExcelUploaderProps> = ({ onFinish, preview = false }) => {
    const [fileList, setFileList] = useState<UploadFile[]>([])
    const [previewData, setPreviewData] = useState<StudentData[]>([])
    const [totalCount, setTotalCount] = useState(0)

    const handleUpload = async (file: File) => {
        try {
            const buffer = await file.arrayBuffer()
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(buffer)
            const worksheet = workbook.getWorksheet(1)

            const jsonData: StudentData[] = []

            if (!worksheet) {
                message.warning('Excel sheet is empty or not found')
                return
            }

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return // Skip header

                const rowVal = row.values as any[]

                if (rowVal && rowVal.length > 1) {
                    jsonData.push({
                        className: String(rowVal[1] || ''),
                        studentName: String(rowVal[2] || ''),
                        idCard: String(rowVal[3] || ''),
                        summerQty: Number(rowVal[4] || 0),
                        springQty: Number(rowVal[5] || 0),
                        winterQty: Number(rowVal[6] || 0)
                    })
                }
            })

            const validData = jsonData.filter(item => item.studentName || item.idCard)

            setPreviewData(validData.slice(0, 5))
            setTotalCount(validData.length)
            message.success(`Parsed ${validData.length} rows successfully`)
            onFinish(validData)
        } catch (error) {
            console.error('Excel parse error:', error)
            message.error('Failed to parse Excel file')
        }
    }

    const uploadProps: UploadProps = {
        name: 'file',
        multiple: false,
        maxCount: 1,
        accept: '.xlsx, .xls',
        fileList: fileList,
        beforeUpload: (file) => {
            const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel';
            if (!isExcel) {
                message.error('You can only upload Excel files!');
                return Upload.LIST_IGNORE;
            }
            setFileList([file]);
            handleUpload(file);
            return false;
        },
        onRemove: () => {
            setFileList([]);
            setPreviewData([]);
            setTotalCount(0);
            onFinish([]);
            return true;
        },
        onDrop(e) {
            console.log('Dropped files', e.dataTransfer.files)
        },
    }

    const columns = [
        { title: '班级', dataIndex: 'className', key: 'className' },
        { title: '学生姓名', dataIndex: 'studentName', key: 'studentName' },
        { title: '身份证号', dataIndex: 'idCard', key: 'idCard' },
        { title: '夏装数量', dataIndex: 'summerQty', key: 'summerQty' },
        { title: '春秋装数量', dataIndex: 'springQty', key: 'springQty' },
        { title: '冬装数量', dataIndex: 'winterQty', key: 'winterQty' },
    ]

    return (
        <div className="w-full">
            <Dragger {...uploadProps} className="mb-6">
                <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽Excel文件到此区域解析</p>
                <p className="ant-upload-hint">
                    支持单个Excel文件(.xlsx)。表格顺序：班级 | 学生姓名 | 身份证号 | 夏装数量 | 春秋装数量 | 冬装数量
                </p>
            </Dragger>

            {preview && previewData.length > 0 && (
                <>
                    <h4 className="mb-2 font-medium text-gray-600">预览（前5行）:</h4>
                    <Table
                        dataSource={previewData}
                        columns={columns}
                        pagination={false}
                        size="small"
                        rowKey={(_, index) => index || 0}
                    />
                    <div className="mt-2 text-right text-gray-400 text-sm">
                        解析 {totalCount} 条记录。
                    </div>
                </>
            )}
        </div>
    )
}

export default ExcelUploader
