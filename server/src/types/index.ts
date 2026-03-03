export interface ProductInput {
    type: number
    price: number
}

export interface StudentInput {
    gradeName: string
    className: string
    studentName: string
    phone: string
    birthday: string
    idCard: string
    summerQty: number
    autumnQty: number
    winterQty: number
}

export interface ImportData {
    schoolName: string
    products: ProductInput[]
    students: StudentInput[]
}
