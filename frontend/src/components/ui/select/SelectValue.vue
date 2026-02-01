<script setup lang="ts">
import type { SelectValueProps } from "reka-ui"
import { SelectValue, useForwardProps } from "reka-ui"

const props = defineProps<SelectValueProps>()

const forwarded = useForwardProps(props)
</script>

<template>
  <SelectValue v-bind="forwarded">
    <slot />
  </SelectValue>
</template>
