import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn } from "typeorm"
import { Grade } from "./Grade"
import { Student } from "./Student"

@Entity("classes")
export class Class {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'grade_id' })
    gradeId!: number

    @Column()
    name!: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @ManyToOne(() => Grade, (grade) => grade.classes)
    @JoinColumn({ name: "grade_id" })
    grade!: Grade

    @OneToMany(() => Student, (student) => student.class)
    students!: Student[]
}
