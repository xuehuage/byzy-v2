import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity("order_temps")
export class OrderTemp {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'client_sn', unique: true })
    clientSn!: string

    @Column({ name: 'school_id' })
    schoolId!: number

    @Column({ name: 'student_name' })
    studentName!: string

    @Column({ name: 'student_phone' })
    studentPhone!: string

    @Column({ name: 'student_birthday' })
    studentBirthday!: string

    @Column({ type: "text", comment: "JSON string of order items" })
    items!: string

    @Column({ type: "int", name: 'total_amount', comment: "Total amount in cents" })
    totalAmount!: number

    @Column({ name: 'qr_code', nullable: true, type: "text" })
    qrCode!: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
