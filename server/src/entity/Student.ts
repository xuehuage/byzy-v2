import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Class } from "./Class"
import { Grade } from "./Grade"
import { Order } from "./Order"

@Entity("students")
@Index("UQ_student_identity", ["name", "phone", "birthday"], { unique: true })
export class Student {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'grade_id', type: "int", nullable: true })
    gradeId!: number | null

    @Column({ name: 'class_id', type: "int", nullable: true })
    classId!: number | null

    @Column()
    name!: string

    @Column({ type: "varchar", nullable: true })
    phone!: string | null

    @Column({ type: "varchar", nullable: true })
    birthday!: string | null

    @Column({ name: 'id_card', type: "varchar", nullable: true })
    idCard!: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @ManyToOne(() => Class, (cls) => cls.students)
    @JoinColumn({ name: "class_id" })
    class!: Class

    @ManyToOne(() => Grade, (grade) => grade.students)
    @JoinColumn({ name: "grade_id" })
    grade!: Grade

    @OneToMany(() => Order, (order) => order.student)
    orders!: Order[]
}
