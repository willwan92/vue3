/**
 * 响应式系统实现：
 * 1. 注册副作用函数：注册时时会调用副作用函数，副作用函数执行时会读取响应式数据
 * 2. 数据劫持：
 *    在读取响应式数据时调用依赖追踪函数收集依赖该数据的副作用函数；
 *    在修改数据时触发依赖该数据的副作用函数
 * 3. 依赖追踪函数：track
 * 4. 触发副作用函数：trigger
 */

// 存储副作用函数的
const bucket = new WeakMap()

// 存储被注册的副作用函数
let activeEffect
const effectStack = []

/**
 * 从数据的关联的依赖集合中清除副作用函数
 * @param {*} effectFn 
 */
function cleanUp(effectFn) {
  let deps = effectFn.deps
  for(let i = 0; i < deps.length; i++) {
    const dep = deps[i]
    // 删除副作用函数
    dep.delete(effectFn)
  }

  effectFn.deps.length = 0
}

/**
 * 用来注册副作用函数
 * @param {Function} fn 副作用函数
 */
function effect(fn) {
  const effectFn = () => {
    // 每次副作用执行时，清除副作用函数
    cleanUp(effectFn)
    activeEffect = effectFn
    effectStack.push(effectFn)
    fn()
    effectStack.pop(effectFn)
    activeEffect = effectStack[effectStack.length - 1]
  }

  // 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = []

  effectFn()
}

function track(target, key) {
  // 没有副作用函数时，直接返回
  if (!activeEffect) return

  let depsMap =  bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }

  // 把当前激活的副作用函数添加到依赖集合 deps 中
  deps.add(activeEffect)

  
  // 将其添加到 activeEffect.deps 数组中
  // 由于deps是引用类型数据，所以可以通过activeEffect.deps访问
  // 上面添加的依赖集合，并通过集合方法删除副作用函数
  activeEffect.deps.push(deps)
}

/**
 * 触发副作用函数
 * @param {*} target 
 * @param {*} key 
 */
function trigger(target, key) {
  let depsMap =  bucket.get(target)
  if (!depsMap) return

  let effects = depsMap.get(key)

  // 由于副作用函数执行时，会先清除上次执行添加到依赖集合的副作用函数，
  // 而且副作用函数执行时会触发数据读取，进而导致再次向数据依赖集合中
  // 添加副作用函数，由于它们操作的都是同一个集合，所以会导致为无限循环，
  // 所以这里需要把副作用函数复制到一个新集合用来执行
  const effectsToRun = new Set(effects) // 新增
  effectsToRun.forEach(effectFn => effectFn());
}


const data = { foo: true, bar: true }
const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key)
    return true
  }
})

let temp1, temp2

effect(function effectFn1() {
  console.log('effectFn1 执行')

  effect(function effectFn2() {
    console.log('effectFn2 执行')
    temp2 = obj.bar
  })

  temp1 = obj.foo
})

// setTimeout(() => {
//   obj.text = '123'
// }, 1000)