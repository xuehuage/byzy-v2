import request from '../utils/request'
import type {
    ApiResponse,
    School,
    SchoolStats,
    ClassEntity,
    OrderListResponse,
    OrderSearchParams,
    OrderUIItem,
    SchoolConfig,
    AfterSalesRecord
} from '../types'

// --- API Methods ---

export interface ExportRow {
    className: string
    studentName: string
    idCard: string
    summerQty: number
    springQty: number
    winterQty: number
    totalAmount: number
    status: string
}

export const importSchoolData = (data: any) => {
    return request.post<ApiResponse<any>>('/import', data)
}

export const getSchoolList = () => {
    return request.get<ApiResponse<School[]>>('/schools')
}

export const getSchoolStats = (params?: { startDate?: string, endDate?: string }) => {
    return request.get<ApiResponse<SchoolStats[]>>('/schools/stats', { params })
}

export const exportSchoolData = (schoolId: number) => {
    return request.get<ApiResponse<ExportRow[]>>(`/schools/${schoolId}/export`)
}

export const getClassList = (schoolId: number) => {
    return request.get<ApiResponse<ClassEntity[]>>('/classes', {
        params: { schoolId }
    })
}

export const getOrderList = (params: OrderSearchParams) => {
    return request.get<ApiResponse<OrderListResponse>>('/orders', {
        params
    })
}

export const updateOrder = (data: OrderUIItem) => {
    return request.put<ApiResponse<any>>(`/orders/${data.id}`, data)
}

export const createSupplementaryOrder = (data: { idCard: string, summerQty: number, springQty: number, winterQty: number }) => {
    return request.post<ApiResponse<any>>('/orders/supplementary', data)
}

export const deleteOrder = (id: number) => {
    return request.delete<ApiResponse<any>>(`/orders/${id}`)
}

// --- V2 Admin APIs ---

export const getSchoolConfig = (id: number) => {
    return request.get<ApiResponse<SchoolConfig>>(`/schools/${id}/config`)
}

export const updateSchoolConfig = (id: number, data: Partial<SchoolConfig>) => {
    return request.put<ApiResponse<any>>(`/schools/${id}/config`, data)
}

export const uploadImage = (formData: FormData) => {
    return request.post<ApiResponse<{ url: string }>>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
}

export const getAfterSalesList = (params: { page: number, pageSize: number, status?: string }) => {
    return request.get<ApiResponse<{ list: AfterSalesRecord[], total: number }>>('/after-sales', { params })
}

export const approveAfterSales = (id: number) => {
    return request.put<ApiResponse<any>>(`/after-sales/${id}/approve`)
}

export const rejectAfterSales = (id: number, reason: string) => {
    return request.put<ApiResponse<any>>(`/after-sales/${id}/reject`, { reason })
}

export const batchCreateSchool = (data: { name: string, classes: string[] }) => {
    return request.post<ApiResponse<any>>('/schools/batch', data)
}

export const batchUpdateSchool = (id: number, data: { name: string, classes: string[] }) => {
    return request.put<ApiResponse<any>>(`/schools/${id}/batch`, data)
}

export const rosterPreview = (data: { schoolId: number, roster: { studentName: string, className: string }[] }) => {
    return request.post<ApiResponse<any>>('/import/roster-preview', data)
}

export const rosterApply = (data: { matches: { studentId: number, classId: number }[] }) => {
    return request.post<ApiResponse<any>>('/import/roster-apply', data)
}

