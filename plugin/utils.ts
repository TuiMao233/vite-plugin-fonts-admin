/*
 * @Author: Mr.Mao
 * @Date: 2021-06-30 14:22:24
 * @LastEditTime: 2021-07-17 14:38:49
 * @Description:
 * @LastEditors: Mr.Mao
 * @autograph: 任何一个傻子都能写出让电脑能懂的代码，而只有好的程序员可以写出让人能看懂的代码
 */
import path from 'path'
import fs from 'fs'
const utils = require('nodejs-fs-utils')
import archiver from 'archiver'
interface FontOption {
  value: string
  key: string
  group: number
}

/**
 * 根据配置生成 SVG 缓存目录
 * @param svgsObject
 */
export const generateSvgCahes = async (fonts: FontOption[]) => {
  const dirPath = path.resolve(__dirname, './caches')
  utils.mkdirsSync(dirPath)
  utils.emptyDirSync(dirPath)
  for (let i = 0; i < fonts.length; i++) {
    const { value, key } = fonts[i]
    fs.writeFileSync(path.resolve(dirPath, `${key}.svg`), value, { flag: 'w' })
  }
  await new Promise((r) => setTimeout(r, 1000))
}

/**
 * 输出压缩打印
 * @param output
 * @param archive
 */
export const archiverLogger = (output: fs.WriteStream, archive: archiver.Archiver) => {
  // 文件输出流结束
  output.on('close', () => {
    console.log(`总共 ${archive.pointer()} 字节`)
    console.log('archiver完成文件的归档，文件输出流描述符已关闭')
  })
  // 数据源是否耗尽
  output.on('end', () => {
    console.log('数据源已耗尽')
  })
  // 存档警告
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('stat故障和其他非阻塞错误')
    } else {
      throw err
    }
  })

  // 存档出错
  archive.on('error', (err) => {
    throw err
  })
}
