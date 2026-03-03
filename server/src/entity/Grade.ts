import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, Unique } from "typeorm"
import { School } from "./School"
import { Class } from "./Class"
import { Student } from "./Student"

@Entity("grades")
@Unique("uk_school_grade", ["schoolId", "name"])
export class Grade {
    @PrimaryGeneratedColumn()
    id!: number

    @Column({ name: 'school_id' })
    schoolId!: number

    @Column()
    name!: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @ManyToOne(() => School, (school) => school.grades)
    @JoinColumn({ name: "school_id" })
    school!: School

    @OneToMany(() => Class, (cls) => cls.grade)
    classes!: Class[]

    @OneToMany(() => Student, (student) => student.grade)
    students!: Student[]
}
