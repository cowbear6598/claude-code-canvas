<script setup lang="ts">
import type { RadioGroupRootEmits, RadioGroupRootProps } from "reka-ui"
import { RadioGroupRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps<RadioGroupRootProps>()
const emits = defineEmits<RadioGroupRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <RadioGroupRoot v-bind="forwarded">
    <slot />
  </RadioGroupRoot>
</template>
