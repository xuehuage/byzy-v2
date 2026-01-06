export interface ProductInput {
    type: number
    price: number
}

export interface StudentInput {
    className: string
    studentName: string
    idCard: string
    summerQty: number
    springQty: number
    winterQty: number
}

export interface ImportData {
    schoolName: string
    products: ProductInput[]
    students: StudentInput[]
}
