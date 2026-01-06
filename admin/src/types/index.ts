export interface StudentData {
    className: string
    studentName: string
    idCard: string
    summerQty: number
    springQty: number
    winterQty: number
}

export interface SchoolDataType {
    id: number
    name: string
    student_count: number
    total_revenue: number
    status: 0 | 1 // 0: Inactive, 1: Active
    created_at: string
}

// --- API Types ---

// 1. Generic API Response Wrapper
export interface ApiResponse<T = any> {
    code: number
    message?: string
    data: T
}

export interface SchoolStats {
    id: number
    name: string
    status: number
    createdAt: string
    studentCount: number
    summerQty: number
    springQty: number
    winterQty: number
    totalRevenue: number
    paidAmount: number
    unpaidAmount: number
}

export interface School {
    id: number
    name: string
    status: number
    createdAt: string
    classes?: ClassEntity[]
    updatedAt: string
}

export interface ClassEntity {
    id: number
    schoolId: number
    name: string
    createdAt: string
}

export interface Order {
    id: number
    studentId: number
    orderNo: string
    totalAmount: number
    status: 'PENDING' | 'PAID' | 'CANCELLED'
    createdAt: string
    student?: {
        name: string
        idCard: string
    }
    items?: any[]
    [key: string]: any
}

// 2. Search Params for Order API
export interface OrderSearchParams {
    page: number
    pageSize: number
    schoolId?: number
    classId?: number
    status?: string
    keyword?: string
}

export interface OrderListResponse {
    list: Order[]
    total: number
    page: number
    pageSize: number
}
