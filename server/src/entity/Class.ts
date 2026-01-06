import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn } from "typeorm"
import { School } from "./School"
import { Student } from "./Student"

@Entity("classes")
export class Class {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'school_id' })
    schoolId!: number

    @Column()
    name!: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @ManyToOne(() => School, (school) => school.classes)
    @JoinColumn({ name: "school_id" })
    school!: School

    @OneToMany(() => Student, (student) => student.class)
    students!: Student[]
}
