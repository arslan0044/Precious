import mongoose from "mongoose";
const { Schema, model } = mongoose;

const addressSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: [true, "Address type is required"],
      enum: {
        values: ["billing", "delivery", "profile"],
        message:
          'Address type must be either "billing", "delivery", or "profile"',
      },
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value) {
          return ["billing", "delivery", "profile"].includes(value);
        },
        message: (props) => `"${props.value}" is not a valid address type.`,
      },
    },
    country: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    zip: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Address = model("Address", addressSchema);

export default Address;
