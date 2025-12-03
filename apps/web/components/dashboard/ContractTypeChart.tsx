/**
 * Contracts Dashboard - Contract Type Distribution Chart
 * Visual breakdown of contracts by type
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { FileText, PieChart as PieChartIcon } from "lucide-react";

interface TypeDistribution {
  type: string;
  count: number;
}

interface ContractTypeChartProps {
  data: TypeDistribution[];
}

const COLORS = [
  { fill: '#3b82f6', gradient: 'from-blue-500 to-blue-600' },
  { fill: '#8b5cf6', gradient: 'from-violet-500 to-purple-600' },
  { fill: '#ec4899', gradient: 'from-pink-500 to-rose-600' },
  { fill: '#f59e0b', gradient: 'from-amber-500 to-orange-600' },
  { fill: '#10b981', gradient: 'from-emerald-500 to-green-600' },
  { fill: '#6366f1', gradient: 'from-indigo-500 to-indigo-600' },
  { fill: '#14b8a6', gradient: 'from-teal-500 to-cyan-600' }
];

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2 }
  }
};

export function ContractTypeChart({ data }: ContractTypeChartProps) {
  const chartData = data.map((item) => ({
    name: item.type,
    value: item.count
  }));
  
  const totalContracts = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <Card className="relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardHeader className="pb-3 relative">
          <CardTitle className="flex items-center gap-2 text-base mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30">
              <PieChartIcon className="h-4 w-4" />
            </div>
            Contract Distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground">By contract type</p>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-3">
                <FileText className="h-12 w-12 opacity-40" />
              </div>
              <p className="font-medium">No contract data available</p>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                      strokeWidth={2}
                      stroke="rgba(255,255,255,0.8)"
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length].fill}
                          className="hover:opacity-80 transition-opacity cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '12px',
                        border: '1px solid rgba(0,0,0,0.1)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>
              
              <motion.div 
                className="mt-4 space-y-2"
                variants={listVariants}
                initial="hidden"
                animate="visible"
              >
                {data.slice(0, 5).map((item, index) => (
                  <motion.div 
                    key={item.type} 
                    variants={itemVariants}
                    whileHover={{ x: 4 }}
                    className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${COLORS[index % COLORS.length].gradient} shadow-sm`}
                      />
                      <span className="text-muted-foreground">{item.type}</span>
                    </div>
                    <span className="font-semibold">{item.count} contracts</span>
                  </motion.div>
                ))}
              </motion.div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
