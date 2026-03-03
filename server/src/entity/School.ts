import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Product } from "./Product"
import { Class } from "./Class"

@Entity("schools")
export class School {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    name!: string

    @Column({ default: 1 })
    status!: number

    @Column({ name: 'summer_image', type: "varchar", nullable: true })
    summerImage!: string | null

    @Column({ name: 'autumn_image', type: "varchar", nullable: true })
    autumnImage!: string | null

    @Column({ name: 'winter_image', type: "varchar", nullable: true })
    winterImage!: string | null

    @Column({ name: 'size_guide_image', type: "varchar", nullable: true })
    sizeGuideImage!: string | null

    @Column({ name: 'is_summer_active', type: 'tinyint', default: 0 })
    isSummerActive!: boolean

    @Column({ name: 'is_autumn_active', type: 'tinyint', default: 0 })
    isAutumnActive!: boolean

    @Column({ name: 'is_winter_active', type: 'tinyint', default: 0 })
    isWinterActive!: boolean

    @Column({ name: 'summer_price', type: 'int', default: 0, comment: "Price in cents" })
    summerPrice!: number

    @Column({ name: 'autumn_price', type: 'int', default: 0, comment: "Price in cents" })
    autumnPrice!: number

    @Column({ name: 'winter_price', type: 'int', default: 0, comment: "Price in cents" })
    winterPrice!: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date

    @OneToMany(() => Product, (product) => product.school)
    products!: Product[]

    @OneToMany(() => Class, (cls) => cls.school)
    classes!: Class[]
}
