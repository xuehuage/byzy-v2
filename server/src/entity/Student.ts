import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Class } from "./Class"
import { Order } from "./Order"

@Entity("students")
@Unique(["idCard"])
export class Student {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'class_id' })
    classId!: number

    @Column()
    name!: string

    @Column({ name: 'id_card' })
    idCard!: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @ManyToOne(() => Class, (cls) => cls.students)
    @JoinColumn({ name: "class_id" })
    class!: Class

    @OneToMany(() => Order, (order) => order.student)
    orders!: Order[]
}
