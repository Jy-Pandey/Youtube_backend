//Higher Order functon - that accept function as a parameter or return the function
// asyncHandler ek higher-order function hai jo async functions ko try-catch ke saath automatically wrap karta hai taki errors ko handle kiya ja sake bina har baar try-catch likhe.
const asyncHandler = (fun) =>{ return async (req, res, next) => {
  try {
      await fun(req, res, next)
  } 
  catch (err) {
      res.status(err.code || 500).json({
          success: false,
          message: err.message
      })
  }
}}

export {asyncHandler}
// const asyncHandler = () => {}
// const asyncHandler = (func) =>{ () => {} }
// const asyncHandler = (func) => async () => {}